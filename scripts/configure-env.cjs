const fs = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const root = path.join(__dirname, '..')
for (const directory of ['Backend', 'Frontend']) {
    const target = path.join(root, directory, '.env')
    if (fs.existsSync(target)) continue
    let content = fs.readFileSync(target + '.example', 'utf8')
    if (directory === 'Backend') content = content.replace(/^JWT_SECRET=$/m, 'JWT_SECRET=' + randomBytes(48).toString('hex'))
    fs.writeFileSync(target, content)
}
console.log('Local environment files are ready. Existing files were preserved.')
