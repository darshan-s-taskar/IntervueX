const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.join(__dirname, '..')
process.env.PUPPETEER_CACHE_DIR = path.join(root, '.cache', 'puppeteer')
const puppeteer = require('../Backend/node_modules/puppeteer')
const { PDFParse } = require('../Backend/node_modules/pdf-parse')

async function verify() {
    const account = JSON.parse(fs.readFileSync(path.join(root, '.runtime', 'verification-account.json')))
    const login = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account),
    })
    assert.equal(login.status, 200, 'Test-account login must succeed')
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const list = await fetch('http://localhost:3000/api/interview/', { headers: { Cookie: cookie } })
    assert.equal(list.status, 200)
    const { interviewReports } = await list.json()
    assert.ok(interviewReports.length, 'A live generated report must exist for the latest browser test account')
    const reportId = interviewReports[0]._id
    const browser = await puppeteer.launch({ headless: true })
    const outputDirectory = path.join(root, 'output', 'pdf')
    fs.mkdirSync(outputDirectory, { recursive: true })
    try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 1000 })
        const errors = []
        page.on('pageerror', err => errors.push(err.message))
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' })
        await page.waitForSelector('#email')
        await page.type('#email', account.email)
        await page.type('#password', account.password)
        await page.click('button')
        await page.waitForSelector('#selfDescription')
        await page.goto('http://localhost:5173/interview/' + reportId, { waitUntil: 'networkidle0' })
        await page.waitForSelector('.interview-page')
        await page.screenshot({ path: path.join(root, '.runtime', 'live-interview.png'), fullPage: true })
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/api/interview/resume/pdf/' + reportId) && response.request().method() === 'POST',
            { timeout: 240000 })
        await page.click('.interview-nav .primary-button')
        const response = await responsePromise
        assert.equal(response.status(), 200, 'Live resume PDF endpoint must return HTTP 200')
        assert.match(response.headers()['content-type'], /application\/pdf/)
        const bytes = await response.buffer()
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
        const outputFile = path.join(outputDirectory, 'intervuex-live-test-resume.pdf')
        fs.writeFileSync(outputFile, bytes)
        const parser = new PDFParse({ data: new Uint8Array(bytes) })
        let text
        try { text = await parser.getText() } finally { await parser.destroy() }
        assert.ok(text.text.trim().length > 100, 'PDF must contain extractable resume text')
        assert.match(text.text, /React|JavaScript/i)
        assert.deepEqual(errors, [])
        const result = { testedAt: new Date().toISOString(), reportId, interviewGeneration: 'passed', resumePdfExport: 'passed', bytes: bytes.length, pages: text.total, extractableCharacters: text.text.length, pdf: outputFile }
        fs.writeFileSync(path.join(root, '.runtime', 'live-verification.json'), JSON.stringify(result, null, 2))
        console.log('PASS: Live report loaded from MongoDB in the browser.')
        console.log('PASS: Download Resume button returned a real PDF generated using Gemini.')
        console.log('PASS: PDF text is extractable and contains the test profile skills.')
        console.log(JSON.stringify(result))
    } finally { await browser.close() }
}
verify().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1 })
