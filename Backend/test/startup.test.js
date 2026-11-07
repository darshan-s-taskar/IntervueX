const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const net = require('node:net')

test('startup fails promptly and safely when MongoDB is unavailable', { timeout: 15000 }, async () => {
    const child = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            MONGO_URI: 'mongodb://127.0.0.1:1/intervuex_unreachable_test',
            JWT_SECRET: randomBytes(48).toString('hex'),
            GOOGLE_GENAI_API_KEY: '',
        },
        windowsHide: true,
    })
    let output = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { output += data })
    const exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', resolve)
    })
    assert.equal(exitCode, 1)
    assert.match(output, /could not start/)
    assert.doesNotMatch(output, /API is running/)
    assert.doesNotMatch(output, /mongodb:\/\//)
})

test('production startup binds 0.0.0.0 and honors the platform PORT', { timeout: 20000 }, async t => {
    const reservation = net.createServer()
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
    const port = reservation.address().port
    await new Promise(resolve => reservation.close(resolve))
    const child = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            NODE_ENV: 'production', HOST: '', PORT: String(port),
            MONGO_URI: 'mongodb://127.0.0.1:27017/intervuex_startup_test',
            JWT_SECRET: randomBytes(48).toString('hex'),
            GOOGLE_GENAI_API_KEY: 'test-process-only',
            FRONTEND_URL: 'https://intervuex.example',
        },
        windowsHide: true,
    })
    t.after(() => child.kill())
    let output = ''
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Production server did not become ready')), 15000)
        child.once('error', reject)
        child.once('exit', () => { clearTimeout(timer); reject(new Error('Production server exited early')) })
        child.stdout.on('data', data => {
            output += data
            if (output.includes('API is running')) { clearTimeout(timer); resolve() }
        })
        child.stderr.on('data', data => { output += data })
    })
    assert.match(output, new RegExp('0\\.0\\.0\\.0:' + port))
    const response = await fetch('http://127.0.0.1:' + port + '/api/health')
    assert.equal(response.status, 200)
    assert.equal((await response.json()).database, 'connected')
    assert.doesNotMatch(output, /mongodb:\/\//)
})
