const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, randomBytes } = require('node:crypto')
const mongoose = require('mongoose')
const puppeteer = require('puppeteer')

// All database writes go to a fresh, isolated test database; existing data is never removed.
// Gemini is mocked in this process only. These tests do not make billable AI requests.
const generated = {
    title: 'Frontend Engineer', matchScore: 80,
    technicalQuestions: [{ question: 'Explain React state', intention: 'State knowledge', answer: 'Use state for mutable UI data' }],
    behavioralQuestions: [{ question: 'Describe teamwork', intention: 'Collaboration', answer: 'Share a concrete example' }],
    skillGaps: [{ skill: 'TypeScript', severity: 'medium' }],
    preparationPlan: [{ day: 1, focus: 'React', tasks: ['Review hooks'] }],
}
let lastRequest
const sdkPath = require.resolve('@google/genai')
require(sdkPath)
require.cache[sdkPath].exports = { GoogleGenAI: class {
    models = { generateContent: async request => {
        lastRequest = request
        return { text: JSON.stringify(request.contents.startsWith('Generate resume')
            ? { html: '<html><body><h1>IntervueX test resume</h1><p>React developer</p></body></html>' }
            : generated) }
    } }
} }

test('IntervueX local integration checks (mocked Gemini, real MongoDB and Chromium)', async t => {
    process.env.JWT_SECRET = randomBytes(48).toString('hex')
    process.env.GOOGLE_GENAI_API_KEY = 'test-process-only'
    process.env.FRONTEND_URL = 'http://localhost:5173'
    const database = 'intervuex_setup_test_' + randomUUID().replaceAll('-', '')
    await mongoose.connect('mongodb://127.0.0.1:27017/' + database, { serverSelectionTimeoutMS: 5000 })
    const app = require('../src/app')
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect() })
    const base = 'http://127.0.0.1:' + server.address().port
    const users = require('../src/models/user.model')
    await users.init()
    const password = randomBytes(20).toString('hex')
    const email = randomUUID() + '@example.invalid'
    let cookie, reportId, otherCookie
    const request = (url, options = {}) => fetch(base + url, options)
    const json = (body, session = cookie) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}) }, body: JSON.stringify(body) })
    const form = (fields, file) => {
        const body = new FormData()
        for (const [key, value] of Object.entries(fields)) body.set(key, value)
        if (file) body.set('resume', new Blob([file], { type: 'application/pdf' }), 'resume.pdf')
        return { method: 'POST', headers: { Cookie: cookie }, body }
    }

    await t.test('health and protected routes', async () => {
        assert.equal((await request('/api/health')).status, 200)
        assert.equal((await request('/api/auth/get-me')).status, 401)
        assert.equal((await request('/api/interview/')).status, 401)
    })
    await t.test('register, cookie flags, password hash, and duplicate protection', async () => {
        const response = await request('/api/auth/register', json({ username: 'setup_' + randomUUID(), email, password }, null))
        assert.equal(response.status, 201)
        const header = response.headers.get('set-cookie')
        assert.match(header, /HttpOnly/)
        assert.match(header, /SameSite=Lax/)
        cookie = header.split(';')[0]
        const saved = await users.findOne({ email })
        assert.notEqual(saved.password, password)
        const duplicate = await request('/api/auth/register', json({ username: 'another_' + randomUUID(), email, password }))
        assert.equal(duplicate.status, 400)
    })
    await t.test('login validation and restored session', async () => {
        assert.equal((await request('/api/auth/login', json({ email, password: 'wrong' }))).status, 400)
        assert.equal((await request('/api/auth/login', json({ email }))).status, 400)
        const response = await request('/api/auth/login', json({ email, password }))
        assert.equal(response.status, 200)
        cookie = response.headers.get('set-cookie').split(';')[0]
        const current = await request('/api/auth/get-me', { headers: { Cookie: cookie } })
        assert.equal((await current.json()).user.email, email)
    })
    await t.test('existing accounts with long passwords can still log in', async () => {
        const legacyPassword = randomBytes(60).toString('hex')
        const legacyEmail = randomUUID() + '@example.invalid'
        await users.create({ username: 'legacy_' + randomUUID(), email: legacyEmail, password: await require('bcryptjs').hash(legacyPassword, 10) })
        const response = await request('/api/auth/login', json({ email: legacyEmail, password: legacyPassword }, null))
        assert.equal(response.status, 200)
        assert.equal((await response.json()).user.email, legacyEmail)
    })
    await t.test('credentialed CORS preflight', async () => {
        const response = await request('/api/auth/login', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } })
        assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
        assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
    })
    await t.test('missing inputs, unsupported files, and upload limits', async () => {
        assert.equal((await request('/api/interview/', form({ jobDescription: 'React developer' }))).status, 400)
        assert.equal((await request('/api/interview/', form({ jobDescription: 'React developer' }, 'not a pdf'))).status, 400)
        assert.equal((await request('/api/interview/', form({ jobDescription: 'React developer' }, Buffer.alloc(3 * 1024 * 1024 + 1)))).status, 400)
    })
    await t.test('missing Gemini key gives an actionable response', async () => {
        delete process.env.GOOGLE_GENAI_API_KEY
        try {
            const response = await request('/api/interview/', form({ jobDescription: 'React developer', selfDescription: 'I build React apps' }))
            assert.equal(response.status, 503)
            assert.match((await response.json()).message, /GOOGLE_GENAI_API_KEY/)
        } finally { process.env.GOOGLE_GENAI_API_KEY = 'test-process-only' }
    })
    await t.test('self-description creates and retrieves a report (mocked Gemini)', async () => {
        const response = await request('/api/interview/', form({ jobDescription: 'React developer', selfDescription: 'I build React apps' }))
        assert.equal(response.status, 201)
        reportId = (await response.json()).interviewReport._id
        assert.ok(lastRequest.config.responseJsonSchema)
        assert.equal((await request('/api/interview/report/' + reportId, { headers: { Cookie: cookie } })).status, 200)
        const list = await (await request('/api/interview/', { headers: { Cookie: cookie } })).json()
        assert.ok(list.interviewReports.some(report => report._id === reportId))
    })
    await t.test('real PDF extraction and interview creation (mocked Gemini)', async () => {
        const browser = await puppeteer.launch({ headless: true })
        try {
            const page = await browser.newPage()
            await page.setContent('<h1>IntervueX PDF Test Candidate</h1><p>JavaScript and React developer</p>')
            const pdf = await page.pdf({ format: 'A4' })
            const response = await request('/api/interview/', form({ jobDescription: 'React developer' }, pdf))
            assert.equal(response.status, 201)
            assert.match((await response.json()).interviewReport.resume, /IntervueX PDF Test Candidate/)
        } finally { await browser.close() }
    })
    await t.test('other users cannot read or export a report', async () => {
        const response = await request('/api/auth/register', json({ username: 'other_' + randomUUID(), email: randomUUID() + '@example.invalid', password }, null))
        otherCookie = response.headers.get('set-cookie').split(';')[0]
        assert.equal((await request('/api/interview/report/' + reportId, { headers: { Cookie: otherCookie } })).status, 404)
        assert.equal((await request('/api/interview/resume/pdf/' + reportId, { method: 'POST', headers: { Cookie: otherCookie } })).status, 404)
    })
    await t.test('resume download returns real PDF bytes (mocked Gemini HTML)', async () => {
        const response = await request('/api/interview/resume/pdf/' + reportId, { method: 'POST', headers: { Cookie: cookie } })
        assert.equal(response.status, 200)
        assert.match(response.headers.get('content-type'), /application\/pdf/)
        const pdf = Buffer.from(await response.arrayBuffer())
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    })
    await t.test('logout invalidates the previous cookie', async () => {
        assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 200)
        assert.equal((await request('/api/auth/get-me', { headers: { Cookie: cookie } })).status, 401)
    })
})
