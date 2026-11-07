// Print locations and rule names only. Never print matched credentials.
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const root = path.join(__dirname, '..')
const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const patterns = [
    ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
    ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
    ['credentialed MongoDB URI', /mongodb(?:\+srv)?:\/\/[^\s'"<>]*:[^\s'"<>]*@/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['JWT', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/],
    ['AWS access key', /(?:AKIA|ASIA)[0-9A-Z]{16}/],
]
const secrets = []
for (const file of ['Backend/.env', 'Frontend/.env', '.env']) {
    const full = path.join(root, file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (!match || !/SECRET|KEY|TOKEN|MONGO_URI/.test(match[1])) continue
        const value = match[2].replace(/^['"]|['"]$/g, '')
        if (value.length >= 16 && !value.startsWith('mongodb://127.0.0.1')) secrets.push(value)
    }
}
const findings = []
function inspect(content, location) {
    for (const [rule, pattern] of patterns) if (pattern.test(content)) findings.push({ location, rule })
    if (secrets.some(value => content.includes(value))) findings.push({ location, rule: 'matches private local credential' })
}
let historicalBlobs = 0
for (const line of git(['rev-list', '--objects', '--all', '--reflog']).split('\n')) {
    const [oid, ...parts] = line.split(' ')
    if (git(['cat-file', '-t', oid]) !== 'blob') continue
    historicalBlobs++
    inspect(cp.execFileSync('git', ['cat-file', '-p', oid], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }), `history:${oid.slice(0, 12)}:${parts.join(' ')}`)
}
const files = git(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n')
const stamp = Date.now().toString()
const snapshot = path.join(root, '.cache', 'publish-audit-' + stamp)
fs.mkdirSync(snapshot, { recursive: true })
for (const file of files) {
    const full = path.join(root, file)
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue
    if ((/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) || /\.(pem|key|p12|pfx|har)$/.test(file)) findings.push({ location: file, rule: 'private file in publish candidates' })
    inspect(fs.readFileSync(full, 'utf8'), file)
    const target = path.join(snapshot, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(full, target)
}
function inspectDist(directory) {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) inspectDist(file)
        else {
            const content = fs.readFileSync(file, 'utf8')
            inspect(content, path.relative(root, file))
            // Router/Axios contain inert "http://localhost" fallbacks for non-browser
            // environments. A port or /api path would indicate an app API target.
            if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+|\/api)/.test(content)) findings.push({ location: path.relative(root, file), rule: 'localhost API URL in production bundle' })
        }
    }
}
inspectDist(path.join(root, 'Frontend', 'dist'))
const scanner = path.join(root, '.tools', 'gitleaks', process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks')
const scans = []
if (fs.existsSync(scanner)) {
    for (const mode of ['history', 'candidates']) {
        const report = path.join(root, '.cache', `gitleaks-${mode}-${stamp}.json`)
        const args = mode === 'history' ? ['git', root, '--log-opts=--all --reflog'] : ['dir', snapshot]
        const result = cp.spawnSync(scanner, [...args, '--redact=100', '--no-banner', '--report-format=json', '--report-path=' + report], { encoding: 'utf8', windowsHide: true })
        const matches = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : []
        scans.push({ mode, exitCode: result.status, findings: matches.length })
        for (const match of matches) findings.push({ location: `${mode}:${match.File}:${match.StartLine}`, rule: match.RuleID })
        if (result.status !== 0 && matches.length === 0) findings.push({ location: mode, rule: 'gitleaks failed to complete' })
    }
} else findings.push({ location: '.tools/gitleaks', rule: 'gitleaks executable unavailable; install official verified release and rerun' })
const result = { commits: Number(git(['rev-list', '--all', '--count'])), historicalBlobs, publishCandidates: files.length, scans, findings }
fs.writeFileSync(path.join(root, '.cache', 'deployment-security-result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
process.exitCode = findings.length ? 1 : 0
