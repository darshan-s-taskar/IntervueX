// Exercise a deployed frontend through its public same-origin API proxy.
// --ai makes TWO live Gemini calls and retains a synthetic account/report.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { randomUUID, randomBytes } = require('node:crypto')
const root = path.join(__dirname, '..')
process.env.PUPPETEER_CACHE_DIR = path.join(root, '.cache', 'puppeteer')
const puppeteer = require('../Backend/node_modules/puppeteer')
const { PDFParse } = require('../Backend/node_modules/pdf-parse')
const input = process.argv[2]
if (!input || input.startsWith('--')) throw new Error('Usage: node scripts/verify-deployment.cjs https://<frontend-origin> [--ai] [--local]')
const base = new URL(input).origin
const local = process.argv.includes('--local')
if (local ? !['localhost', '127.0.0.1'].includes(new URL(base).hostname) : !base.startsWith('https://')) throw new Error('Use HTTPS for deployment verification; --local is restricted to loopback hosts.')
const liveAi = process.argv.includes('--ai')
const directory = path.join(root, '.runtime', 'deployment-' + Date.now())
fs.mkdirSync(directory, { recursive: true })
const results = { origin: base, environment: local ? 'local-production-build' : 'deployed', liveAi, tests: [], status: 'running' }
const pass = name => { results.tests.push({ name, status: 'PASS' }); console.log('PASS: ' + name) }
const save = () => fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(results, null, 2))

async function verify() {
    const health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(120000) })
    assert.equal(health.status, 200, 'Health through same-origin proxy')
    assert.equal((await health.json()).database, 'connected')
    assert.match(health.headers.get('cache-control'), /no-store/)
    pass('Same-origin API health and database connectivity')
    const browser = await puppeteer.launch({ headless: true })
    try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 1000 })
        const errors = [], foreignApi = [], bundleChecks = []
        page.on('pageerror', () => errors.push('Uncaught browser error'))
        page.on('request', request => {
            const url = new URL(request.url())
            if (url.pathname.startsWith('/api/') && url.origin !== base) foreignApi.push(url.origin)
        })
        page.on('response', response => {
            if (new URL(response.url()).pathname.endsWith('.js')) bundleChecks.push(response.text().then(text => {
                assert.doesNotMatch(text, /AIza[0-9A-Za-z_-]{35}|mongodb(?:\+srv)?:\/\//, 'No API keys/database URIs in JavaScript')
                assert.doesNotMatch(text, /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/, 'No localhost API target in browser bundle')
            }))
        })
        const response = await page.goto(base, { waitUntil: 'networkidle0' })
        assert.equal(response.status(), 200)
        await page.waitForSelector('#email')
        assert.equal(await page.title(), 'IntervueX')
        pass('Homepage loads and protected dashboard opens login')
        const account = { username: 'deployment_' + randomUUID(), email: randomUUID() + '@example.invalid', password: randomBytes(24).toString('hex') }
        fs.writeFileSync(path.join(directory, 'account.json'), JSON.stringify(account))
        await page.goto(base + '/register', { waitUntil: 'networkidle0' })
        await page.waitForSelector('#username')
        await page.type('#username', account.username)
        await page.type('#email', account.email)
        await page.type('#password', account.password)
        await page.click('button[type="submit"], form button')
        await page.waitForSelector('#selfDescription')
        pass('Registration and dashboard')
        const cookies = await page.cookies()
        const token = cookies.find(cookie => cookie.name === 'token')
        assert.ok(token?.httpOnly)
        assert.equal(token.sameSite, 'Lax')
        if (!local) assert.equal(token.secure, true)
        assert.equal(await page.evaluate(() => document.cookie.includes('token=')), false)
        await page.reload({ waitUntil: 'networkidle0' })
        await page.waitForSelector('#selfDescription')
        pass('Cookie flags and authentication persistence after reload')
        await page.click('[aria-label="Log out"]')
        await page.waitForSelector('#email')
        assert.equal(await page.evaluate(async () => (await fetch('/api/auth/get-me')).status), 401)
        pass('Logout button and session removal')
        await page.type('#email', account.email)
        await page.type('#password', account.password)
        await page.click('form button')
        await page.waitForSelector('#selfDescription')
        pass('Login restores dashboard')
        if (liveAi) {
            await page.type('.panel--left textarea', 'Frontend engineer: React, JavaScript, accessible HTML and CSS, collaboration and web testing.')
            await page.type('#selfDescription', 'Synthetic deployment test candidate. I build small React and JavaScript projects. I practice accessible HTML and CSS. I have no employment or contact details to supply.')
            await page.click('.generate-btn')
            await page.waitForSelector('.interview-page, [role="alert"]', { timeout: 120000 })
            assert.ok(await page.$('.interview-page'), 'Gemini report must render without an error')
            assert.ok(await page.$('.q-list'))
            const reportId = new URL(page.url()).pathname.split('/').pop()
            results.reportId = reportId
            pass('Live Gemini interview report generation')
            const stored = await page.evaluate(async id => {
                const list = await (await fetch('/api/interview/')).json()
                const report = await fetch('/api/interview/report/' + id)
                return { listed: list.interviewReports?.some(item => item._id === id), status: report.status }
            }, reportId)
            assert.equal(stored.listed, true)
            assert.equal(stored.status, 200)
            pass('Saved report listed and retrieved from database')
            const nested = await page.reload({ waitUntil: 'networkidle0' })
            assert.equal(nested.status(), 200)
            await page.waitForSelector('.interview-page')
            pass('Authenticated nested React Router refresh')
            const pdfResponse = page.waitForResponse(response => response.url().includes('/api/interview/resume/pdf/') && response.request().method() === 'POST', { timeout: 120000 })
            const buttons = await page.$$('button')
            let clicked = false
            for (const button of buttons) if (/Download Resume/i.test(await button.evaluate(el => el.textContent))) { await button.click(); clicked = true; break }
            assert.ok(clicked, 'Download Resume button')
            const pdf = await pdfResponse
            assert.equal(pdf.status(), 200)
            assert.match(pdf.headers()['content-type'], /application\/pdf/)
            const bytes = Buffer.from(await pdf.buffer())
            assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
            const parser = new PDFParse({ data: new Uint8Array(bytes) })
            try { assert.ok((await parser.getText()).text.trim().length > 30) } finally { await parser.destroy() }
            fs.writeFileSync(path.join(directory, 'synthetic-resume.pdf'), bytes)
            pass('Live resume PDF download and readable content')
        } else {
            results.tests.push({ name: 'Live AI report, persistence and PDF', status: 'NOT RUN' })
            const nested = await page.goto(base + '/interview/000000000000000000000000', { waitUntil: 'networkidle0' })
            assert.equal(nested.status(), 200)
            await page.waitForSelector('[role="alert"]')
            pass('Nested route refresh serves SPA and handles missing report')
        }
        await Promise.all(bundleChecks)
        assert.deepEqual(errors, [])
        assert.deepEqual(foreignApi, [])
        pass('No browser errors, cross-origin API calls, localhost API targets or visible API keys')
        await page.screenshot({ path: path.join(directory, 'browser.png'), fullPage: true })
        results.status = 'PASS'
    } finally { await browser.close() }
}
verify().catch(error => {
    results.status = 'FAIL'
    results.tests.push({ name: 'Verification stopped; inspect private local evidence', status: 'FAIL' })
    results.failure = { name: error.name }
    fs.writeFileSync(path.join(directory, 'error.json'), JSON.stringify({ name: error.name, message: error.message }))
    console.error('FAIL: Deployment verification stopped. Results are in the ignored .runtime directory; credentials and responses were not printed.')
    process.exitCode = 1
}).finally(save)
