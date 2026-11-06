const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

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
