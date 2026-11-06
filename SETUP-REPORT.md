# IntervueX local setup report

Verified on 6 November 2026 on this Windows laptop. Workspace: `C:\Users\darsh\Desktop\IntervueX`.

## Current result

- Frontend: **http://localhost:5173**, responding with HTTP 200 and verified in headless Chromium.
- API: **http://localhost:3000/api/health**, responding with HTTP 200 and `database: connected`.
- Portable MongoDB: listening on `127.0.0.1:27017`; application database `intervuex`; persistent files in `.data/mongodb`.
- All three background processes are running. Stop/start was tested successfully.
- **Live Gemini interview generation and resume PDF export passed** using the privately configured key and `gemini-3-flash-preview`. The backend was restarted, and the actual browser flows were exercised. No key was printed or copied into documentation.

## Installed / reused

| Item | Result |
| --- | --- |
| Node.js 24.12.0 | Already installed; compatible LTS major |
| npm 11.6.2 | Already installed |
| Git 2.52.0.windows.1 | Already installed; optional for running this ZIP extraction |
| Backend npm dependencies | 293 packages installed with the existing lockfile using `npm ci` |
| Frontend npm dependencies | 191 packages installed with the existing lockfile using `npm ci` |
| MongoDB Community 8.0.34 Windows x64 | Portable ZIP installed under `.tools` with user approval; official archive SHA-256 verified |
| Chrome for Testing 145.0.7632.77 | Downloaded by the project's existing Puppeteer dependency into `.cache/puppeteer` |

No system-wide installation, Windows service, PATH change, or persistent execution-policy change was made. Dependency versions were retained; lockfile changes update root package branding/engine metadata only.

## Corrections made

1. Replaced `npx nodemon` with built-in `node --watch` because nodemon was not a declared dependency. Added a normal backend `start` command.
2. Made backend port, bind address, CORS frontend origin, frontend API origin, and Gemini model configurable.
3. Added example and private local environment files; generated a random JWT secret; ignored sensitive files and local runtime/data/cache directories.
4. Backend now waits for MongoDB and exits promptly if connection/configuration fails. Added a health endpoint.
5. Delayed Gemini client creation until an AI request so a missing key does not prevent login/registration or server startup.
6. Corrected pdf-parse v2 constructor usage, destroyed parser resources, and enabled self-description-only requests already advertised by the UI.
7. Corrected upload instructions from unsupported DOCX/5 MB to PDF/3 MB and added input/PDF error responses.
8. Passed JSON Schema through the SDK's `responseJsonSchema` option and validated generated JSON with the existing Zod schemas.
9. Fixed resume export ownership filtering and converted Puppeteer's returned bytes into a Buffer for an actual PDF response. Browser resources close on failure; generated HTML cannot execute scripts or fetch remote resources during rendering.
10. Set HttpOnly/SameSite cookie options consistently for login, registration, and logout. Added missing login-field and missing-account checks.
11. Fixed swallowed frontend errors and null response dereferences. Failed login no longer navigates as if it succeeded. Authentication loads centrally; duplicate report requests were removed. Errors display in the page; controlled text fields retain their values after errors.
12. Applied IntervueX branding in browser title, login/register/home, package metadata, and documentation without changing routes, collections, or internal model identifiers.
13. Replaced deprecated Sass color calls with equivalent `color.adjust` calls; final build emits no Sass deprecation warnings.
14. Added Windows install/start/stop scripts, real integration tests, and browser verification.
15. During live verification, corrected PowerShell 5 JSON-array handling in the stop/restart scripts and added a backend-only restart command.
16. Live PDF inspection found that Gemini invented personal details for a sparse profile. Added a focused resume prompt instruction to preserve supplied facts and omit or mark missing information. Re-tested the actual Download Resume button with live Gemini after this correction.

## Files added or changed

- Root: `.gitignore`, `.npmrc`, `README.md`, `SETUP-REPORT.md`.
- Backend configuration: `.gitignore`, `.npmrc`, `.puppeteerrc.cjs`, `.env.example`, private `.env`, `package.json`, `package-lock.json`, `server.js`.
- Backend source: `src/app.js`, `src/config/database.js`, new `src/config/cookie.js`, `src/controllers/auth.controller.js`, `src/controllers/interview.controller.js`, `src/services/ai.service.js`.
- Backend tests: `test/setup.test.js`, `test/startup.test.js`.
- Frontend configuration: `.gitignore`, `.npmrc`, `.env.example`, private `.env`, `package.json`, `package-lock.json`, `vite.config.js`, `index.html`, `README.md`.
- Frontend shared API: new `src/api.js`.
- Auth: `src/features/auth/auth.context.jsx`, new `auth.state.js`, `hooks/useAuth.js`, `services/auth.api.js`, `pages/Login.jsx`, `pages/Register.jsx`.
- Interview: `src/features/interview/interview.context.jsx`, new `interview.state.js`, `hooks/useInterview.js`, `services/interview.api.js`, `pages/Home.jsx`, `pages/Interview.jsx`, `style/home.scss`, `style/interview.scss`.
- Scripts: `scripts/install.ps1`, `configure-env.cjs`, `start.ps1`, `stop.ps1`, `stop-mongo.cjs`, `restart-backend.ps1`, `verify-browser.cjs`, `verify-live-export.cjs`.
- Ignored local generated content: `.tools`, `.cache`, `.data`, `.runtime`, each `node_modules`, frontend `dist`.

## Actual verification

| Check | Result |
| --- | --- |
| Both `npm ci` installs | PASS; no dependency conflicts or engine failures |
| `npm ls --depth=0` for both packages | PASS; all declared dependencies installed |
| Backend JavaScript syntax | PASS |
| Frontend `npm run lint` | PASS |
| Frontend `npm run build` | PASS; 106 modules transformed |
| Backend `npm test` | PASS; 13 tests reported, zero failures |
| MongoDB connection and persistence across stop/start | PASS |
| Frontend HTTP and API health HTTP | PASS; both return 200 |
| Credentialed CORS preflight | PASS |
| Registration, password hashing, duplicate registration | PASS against real MongoDB |
| Valid/invalid login, current-user lookup, cookie flags | PASS |
| Logout and blacklisting of previous cookie | PASS |
| Invalid input/file/size handling | PASS |
| Self-description and real PDF interview input | PASS using mocked Gemini and real PDF extraction |
| Report retrieval/listing and other-user access rejection | PASS using test-created reports |
| Resume export | PASS; real Chromium PDF from mocked Gemini HTML, correct bytes/content type |
| Backend startup when MongoDB unavailable | PASS; exits without falsely claiming the API is running or printing the URI |
| Browser registration/login/session restoration/logout | PASS against the real running app |
| Browser missing-key error and form behavior | PASS; no uncaught JavaScript errors |
| Stop/start launcher cycle | PASS; data preserved |
| Live Gemini model lookup and text generation | PASS; configured model accepted the private key |
| Live interview generation in browser | PASS; saved Frontend Engineer report with 3 technical questions, 2 behavioral questions, 3 skill gaps, and a 5-day plan |
| Live resume export through Download Resume button | PASS; HTTP 200, application/pdf, 52,925 bytes, one A4 page, 776 extractable text characters |
| Final live PDF rendering | PASS; Poppler-rendered final page inspected with no clipping or overlapping text; missing personal details are marked, synthetic test profile only |
| Backend-only restart and process tracking | PASS; MongoDB and frontend remain running, process start times match |
| npm vulnerability audit | NOT CLEAN; see below |

The browser screenshot is `.runtime/browser-verification.png`. Automated integration tests create fresh `intervuex_setup_test_*` databases and never drop databases or delete existing records. Browser verification creates test accounts in the app database; random test credentials are stored only in ignored `.runtime/verification-account.json`. Register your own account for regular use.

## Dependency audit findings

The supplied lockfiles were retained as requested. `npm audit` reported:

| Package tree | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 3 | 14 | 6 | 0 | 23 |
| Frontend | 0 | 16 | 4 | 2 | 22 |

These are npm's package/advisory classifications, including transitive and development dependencies, not a demonstrated exploit of this running app. Backend findings include the Puppeteer dependency tree, protobufjs, Express transitive dependencies, Mongoose, Multer, and Zod; frontend findings include Axios, React Router, Vite, and build dependencies. Some suggested fixes require major version changes, including Puppeteer and Zod. Full machine-readable reports are `.cache/backend-audit.json` and `.cache/frontend-audit.json`.

No `npm audit fix --force` or broad upgrades were applied. Installation also emitted upstream `glob` and `node-domexception` deprecation notices. A dependency-security update should be reviewed and tested separately before deployment. The servers are bound to the local machine for this local setup.

## Live verification completed

The user saved the key privately in `Backend/.env`. The backend was restarted and both live AI features passed on 6 November 2026. No additional credential setup is required for these features. The generated sample is `output/pdf/intervuex-live-test-resume.pdf`; browser evidence is `.runtime/live-interview.png`, and machine-readable results are `.runtime/live-verification.json`. AI resume content should still be reviewed before personal use; the live sample now omits or marks details absent from the input.

To repeat the live checks, run `node scripts/verify-browser.cjs --ai` followed by `node scripts/verify-live-export.cjs`. These calls use Google API quota and generate synthetic test data.

## Start / stop later

From `C:\Users\darsh\Desktop\IntervueX`:

```powershell
# Start MongoDB, backend, and frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1

# Stop the managed processes and preserve database data
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1

# Restart only the backend to reload Backend/.env
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restart-backend.ps1
```

Open **http://localhost:5173** after starting. Foreground commands and troubleshooting are in `README.md`.

## Scope exception observed and corrected

During verification, relative npm cache paths briefly resolved to `C:\Users\darsh\Desktop\.cache\npm`, outside the project. The npm configuration was corrected and verified to resolve inside IntervueX for subsequent commands. No source, database, or software was installed there by the setup workflow; npm may have written logs/cache metadata. Nothing outside IntervueX was removed.
