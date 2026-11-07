const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, randomBytes } = require('node:crypto')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')

test('production authentication, origin checks, limits and private responses', async t => {
    process.env.NODE_ENV = 'production'
    process.env.FRONTEND_URL = 'https://intervuex.example'
    process.env.JWT_SECRET = randomBytes(48).toString('hex')
    process.env.GOOGLE_GENAI_API_KEY = 'test-process-only'
    await mongoose.connect('mongodb://127.0.0.1:27017/intervuex_production_test_' + randomUUID().replaceAll('-', ''))
    const app = require('../src/app')
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect() })
    const base = 'http://127.0.0.1:' + server.address().port
    const request = (route, options) => fetch(base + route, options)
    const headers = { Origin: process.env.FRONTEND_URL, 'Content-Type': 'application/json' }
    let cookie, userId

    await t.test('health has no credential/configuration details and is never cached', async () => {
        const response = await request('/api/health')
        assert.equal(response.status, 200)
        assert.deepEqual(Object.keys(await response.json()).sort(), ['application', 'database'])
        assert.equal(response.headers.get('cache-control'), 'no-store')
        assert.equal(response.headers.get('x-powered-by'), null)
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    })
    await t.test('rejects untrusted origins and missing origins before writes', async () => {
        for (const origin of ['https://attacker.invalid', 'null', undefined]) {
            const response = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}' })
            assert.equal(response.status, 403)
            assert.equal(response.headers.get('access-control-allow-origin'), null)
        }
    })
    await t.test('registration issues a secure host-only cookie for the proxy origin', async () => {
        const response = await request('/api/auth/register', {
            method: 'POST', headers,
            body: JSON.stringify({ username: 'production_' + randomUUID(), email: randomUUID() + '@example.invalid', password: randomBytes(20).toString('hex') }),
        })
        assert.equal(response.status, 201)
        const setCookie = response.headers.get('set-cookie')
        for (const flag of [/HttpOnly/, /Secure/, /SameSite=Lax/, /Path=\//]) assert.match(setCookie, flag)
        assert.doesNotMatch(setCookie, /Domain=/i)
        cookie = setCookie.split(';')[0]
        userId = (await response.json()).user.id
        assert.equal((await request('/api/auth/get-me', { headers: { Cookie: cookie } })).status, 200)
    })
    await t.test('JWT verification rejects other algorithms and malformed subjects', async () => {
        for (const [id, algorithm] of [[userId, 'HS384'], ['not-an-id', 'HS256']]) {
            const token = jwt.sign({ id }, process.env.JWT_SECRET, { algorithm, expiresIn: '1d' })
            assert.equal((await request('/api/auth/get-me', { headers: { Cookie: 'token=' + token } })).status, 401)
        }
    })
    await t.test('invalid inputs and oversized requests fail without leaking internals', async () => {
        const bad = await request('/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ email: { $ne: null }, password: 'bad' }) })
        assert.equal(bad.status, 400)
        const large = await request('/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ padding: 'x'.repeat(140000) }) })
        assert.equal(large.status, 413)
        const invalid = await request('/api/interview/', { method: 'POST', headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ jobDescription: { $ne: null }, selfDescription: 'text' }) })
        assert.equal(invalid.status, 400)
        const report = await request('/api/interview/report/not-an-object-id', { headers: { Cookie: cookie } })
        assert.equal(report.status, 400)
        const body = await report.text()
        assert.doesNotMatch(body, /stack|mongoose|JWT_SECRET|mongodb:|GOOGLE_GENAI_API_KEY/i)
    })
    await t.test('logout requires a trusted POST and invalidates the previous JWT', async () => {
        assert.equal((await request('/api/auth/logout', { headers: { Cookie: cookie } })).status, 404)
        assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 403)
        const response = await request('/api/auth/logout', { method: 'POST', headers: { ...headers, Cookie: cookie } })
        assert.equal(response.status, 200)
        assert.match(response.headers.get('set-cookie'), /Secure/)
        assert.equal((await request('/api/auth/get-me', { headers: { Cookie: cookie } })).status, 401)
    })
    await t.test('authentication attempts eventually return 429 and Retry-After', async () => {
        let blocked
        for (let i = 0; i < 31; i++) {
            const response = await request('/api/auth/login', { method: 'POST', headers, body: '{}' })
            if (response.status === 429) { blocked = response; break }
            assert.equal(response.status, 400)
        }
        assert.ok(blocked)
        assert.ok(Number(blocked.headers.get('retry-after')) > 0)
    })
})
