# IntervueX deployment report

Prepared on **7 November 2026 (Asia/Calcutta)**. This report distinguishes executed local checks from pending cloud deployment tests. No secret values are included.

Deployment continuation: the user approved the GitHub push and free Render/Vercel provisioning on 7 November 2026. Secrets will be entered directly in provider dashboards. The preparation snapshot below will be updated with provisioned resources and live results as deployment proceeds.

## Deployment status and URLs

| Resource | URL / status |
| --- | --- |
| GitHub | [darshan-s-taskar/IntervueX](https://github.com/darshan-s-taskar/IntervueX), already existed and was public before this deployment work |
| Vercel frontend | **Not provisioned or deployed; URL pending** |
| Render backend | **Not provisioned or deployed; URL pending** |
| MongoDB Atlas | **Production cluster, credentials, network access and connectivity not verified** |

No repository was created, code pushed, cloud service provisioned, billing enabled, credential rotated, or existing data deleted during preparation. GitHub and Vercel account reads succeeded. Render account access succeeded and listed **My Workspace**; workspace selection and external changes require the user's approval. GitHub CLI is installed but signed out; the connected GitHub integration is authenticated as `darshan-s-taskar`. A MongoDB Atlas integration was found but is not connected; connecting it is optional if using the private dashboard steps below.

The local checkout began at `dad7ef7`; fetched `origin/main` is `23b60ae`, one commit ahead. That remote commit removes the original project's acknowledgement. This preparation restores the credit in accordance with the current request. Preserve both existing commits when integrating the prepared changes; do not force-push or rewrite history. Changes remain local and unstaged for review.

## Prepared deployment settings

### Render Express backend

| Setting | Value |
| --- | --- |
| Repository | Existing GitHub repository above, after an approved push |
| Root directory | `Backend` |
| Runtime | Docker |
| Dockerfile path | `./Dockerfile`, relative to `Backend` |
| Docker build context | `.`, relative to `Backend` |
| Build | Dockerfile installs Linux libraries/fonts and executes `npm ci --omit=dev --no-audit --no-fund` |
| Production start | `npm start` -> `node server.js`, under `tini -g` |
| Node | Current Node 24 patch from `node:24-bookworm-slim`; both packages require `24.x` |
| Network binding | `0.0.0.0` and Render-provided `PORT` |
| Health check | `/api/health`; HTTP 200 when MongoDB is connected, 503 otherwise |
| Proposed initial plan | `free`; no purchase or paid upgrade authorized |
| Automatic deploys | Disabled in `render.yaml` |
| Persistent application files | None required; reports/accounts live in Atlas, PDFs are returned from memory |

`render.yaml` is the Blueprint. Root-relative Docker settings follow [Render's monorepo documentation](https://render.com/docs/monorepo-support). The image runs as the non-root `node` user and includes Chromium's libraries, unzip, fonts, and an image-local matching Chrome download. Credentials and Windows caches are excluded from the build context; explicit COPY statements include only application source and package configuration.

Chrome's host sandbox is disabled explicitly inside the Render container. The renderer disables JavaScript, service workers, external requests and local-file loads, adds a restrictive HTML CSP, limits HTML length, closes browser resources on error, and sets render timeouts. Generation is serialized per API process to reduce memory spikes. **The image has not been built or run on Render/Linux yet; Linux PDF compatibility remains a required cloud check.** Docker was not available on this Windows host.

Render describes its Free instances as suitable for previews rather than production services. Cold starts and the Free memory limit can affect Chromium and API latency. The Blueprint uses Free to avoid unauthorized spending. Do not claim production reliability or upgrade the plan until live PDF/memory testing and explicit cost approval. See [Render Free service limitations](https://render.com/docs/free).

### Vercel React frontend

| Setting | Value |
| --- | --- |
| Root directory | `Frontend` |
| Framework | Vite |
| Node | `24.x` |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Configuration | `Frontend/vercel.ts` |
| API routing | `/api/:path*` -> actual Render origin plus `/api/:path*` |
| SPA routing | Page paths rewrite to `/index.html`; `/api` and `/assets/` are excluded from the page fallback |

`BACKEND_ORIGIN` is evaluated by Vercel while loading its configuration. It is not a Vite/browser variable. A missing value, HTTP value, path, trailing slash, or non-Render host fails configuration loading. Use the actual assigned Render origin, not an assumed example hostname. Changing it requires a new frontend deployment. Programmatic configuration and external rewrites follow [Vercel configuration documentation](https://vercel.com/docs/project-configuration/vercel-ts) and [Vercel rewrite documentation](https://vercel.com/docs/routing/rewrites).

Production Axios always uses relative URLs, so an old local `VITE_API_BASE_URL` cannot redirect the deployed app to localhost. Development can use that optional override or Vite's local `/api` proxy. Local preview also proxies `/api` to port 3000.

## Environment variable names and placement

| Name | Location | Requirement / purpose |
| --- | --- | --- |
| `MONGO_URI` | Render secret | Required Atlas connection URI; database `intervuex`; never copy into frontend settings |
| `JWT_SECRET` | Render secret | Required random secret, at least 32 characters; Blueprint generates an independent production secret on initial provisioning |
| `GOOGLE_GENAI_API_KEY` | Render secret | Required in production; use the privately held Gemini key with an appropriate Google project |
| `GEMINI_MODEL` | Render | Selected model for structured generation; retained configured model passed local live tests; confirm production project availability/quota |
| `NODE_ENV` | Render / Dockerfile | Production runtime mode, supplied by Blueprint and Dockerfile |
| `HOST` | Render / Dockerfile | Public service bind interface, supplied by Blueprint and Dockerfile |
| `PORT` | Render platform | Platform-injected; do not override Render's assigned port |
| `FRONTEND_URL` | Render | Exact final HTTPS Vercel production origin, no trailing slash; required for startup and origin checks |
| `PUPPETEER_CACHE_DIR` | Dockerfile | Browser cache under the image's non-root home directory |
| `PUPPETEER_NO_SANDBOX` | Dockerfile | Explicit container-only Chrome setting; keep unset for normal Windows development |
| `BACKEND_ORIGIN` | Vercel production configuration | Non-secret actual HTTPS Render origin, no trailing slash; required before deployment |
| `VITE_API_BASE_URL` | Local development only | Optional public API origin override; production ignores it; leave unset in Vercel |

Do not set `PUPPETEER_SKIP_DOWNLOAD` on Render: the image requires its Linux Chrome download. Do not add a cookie Domain attribute or change SameSite to None for this topology.

## Account actions and deployment sequence

1. **Approve publication and provisioning.** Reuse the existing `IntervueX` repository, select Render **My Workspace**, and approve creating the Vercel `intervuex` project and a Free Render API service. No duplicate repository is needed. A Render Blueprint plan must be reviewed before applying it; keep Blueprint automatic syncing disabled during setup. No paid plan, billing activation, domain purchase, or credential rotation is included.
2. **Publish only the reviewed source.** Integrate `origin/main` without discarding either existing commit, run the security scan again, review the exact staged list, and push only after approval. Do not run an indiscriminate add of ignored files. The authenticated GitHub integration can publish through GitHub's API; a CLI push instead requires the user to run `gh auth login --web --git-protocol https` locally and sign in through GitHub. Never paste a token into chat.
3. **Reserve the frontend project/domain.** After approval, create or reuse the Vercel project linked to GitHub, set root `Frontend`, Node 24.x, and the build settings above. Record the actual production domain before configuring Render. The first frontend deployment must wait for `BACKEND_ORIGIN`.
4. **Configure Atlas privately.** Sign in at [MongoDB Atlas](https://cloud.mongodb.com/). Select an existing cluster or create only a clearly labelled Free cluster; stop if billing or a paid tier is required. Under Database Access, create a database user with `readWrite` limited to the application database, not an Atlas administration account. Use Connect -> Drivers to obtain the URI, select database `intervuex`, and URL-encode password characters as needed. Keep the URI in a private password manager and paste it directly into Render, not chat. Do not import or remove the laptop database as part of deployment.
5. **Create/configure the Render service.** After approval and the reviewed Blueprint plan, provision from `render.yaml`. On the service's Environment page, enter `MONGO_URI` and `GOOGLE_GENAI_API_KEY` directly, and set `FRONTEND_URL` to the domain from step 3. The Blueprint generates `JWT_SECRET`; do not replace the existing laptop secret. Render's API tools expose submitted secret values in tool context, so use the dashboard for private entry. If initial provisioning starts a deploy before these values exist, let that attempt fail, complete Environment settings, then deploy again.
6. **Allow Render egress in Atlas.** In the Render service, open Connect -> Outbound and copy every listed CIDR. Add those ranges to Atlas Network Access. Avoid opening access to all IPs. The ranges are region-specific and shared; authenticated database access remains necessary. See [Render outbound addresses](https://render.com/docs/outbound-ip-addresses) and [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/). A temporary laptop IP entry is needed only for direct laptop-to-Atlas checks, not for the deployed API.
7. **Deploy/verify the backend.** Confirm startup and `/api/health` through the real Render URL. The backend will refuse production startup if the origin, JWT secret, Gemini key or database connection is missing/invalid. Do not copy full environment values or connection strings from logs into a report.
8. **Deploy the frontend after approval.** Set Vercel Production `BACKEND_ORIGIN` to the actual healthy Render origin, then deploy. Ensure the production website is publicly accessible; do not change protections on unrelated projects. Keep production backend secrets out of Vercel. Set preview environment access separately if later needed; production origin checks intentionally reject arbitrary preview domains.
9. **Run live tests.** Execute the verification command below against the actual Vercel origin and inspect Render memory/logs during PDF generation. Update the URL/status tables and test results only after observing success. If AI fails for quota, enter the existing project in [Google AI Studio](https://aistudio.google.com/) to check key/model/quota settings. Do not enable billing without approval.

## Security checks and changes

| Check | Observed result |
| --- | --- |
| Git history | All fetched branches/tags and local reflog history scanned: 2 commits, 66 historical blobs before this preparation is committed |
| Gitleaks | v8.30.1 downloaded from its official release; archive SHA-256 verified against release checksums; history and publish candidates: zero findings |
| Additional secret checks | Publish candidates and historical blobs compared against actual private local credential values in memory; zero matches; values never printed |
| Git exclusions | `.env`, `.env.*`, `.env.local`, local configuration, keys, credentials files, database files/backups, uploads, HAR files, hosting metadata, caches and generated output ignored |
| Tracked ignored files / staging | No tracked ignored files detected; no staged files during preparation |
| Browser credentials | Gemini key, database URI and JWT signing secret remain backend-only; production bundle and browser requests checked |
| Frontend targets | No localhost API target in the production bundle and no off-origin API request during the local production-build browser test |
| Cookies/JWT | Host-only, HttpOnly, SameSite=Lax; Secure in production; 1-day JWT; HS256 verification restricted; unique JWT IDs prevent re-login collisions after logout |
| Request origins | Exact frontend origin enforced; production writes require that Origin; wildcard origins and arbitrary previews rejected |
| Logout | Authenticated POST; old GET no longer changes session state; dashboard provides a Log out button |
| Private responses | `Cache-Control: no-store` on API responses/proxy; health hides Gemini configuration in production; errors omit stack traces and upstream credential details |
| Headers | Helmet on API; nosniff, frame protection, referrer and permissions policies prepared for frontend |
| Abuse/input limits | Login/registration rate limits; per-account AI limits; one concurrent generation; bounded JSON/text/multipart uploads and PDF signature validation |
| Report ownership | Retrieval and PDF export remain filtered to the authenticated user's reports; other-user rejection passed integration tests |
| Dependency audit before | Backend: 23 findings (3 critical, 14 high, 6 moderate). Frontend: 22 (16 high, 4 moderate, 2 low) |
| Dependency audit after | Backend and frontend: **0 findings**, including development dependencies, in executed npm audits |

Compatible dependency updates were applied first. The remaining backend advisories required Puppeteer 25 and Zod 4; the obsolete schema-conversion adapter was removed in favor of native `z.toJSONSchema`. React/Vite/Express/Mongoose/Gemini major versions were otherwise preserved. Lockfiles record exact installed versions; audits are point-in-time findings, not a guarantee against unknown vulnerabilities.

Raw dependency reports and redacted scanner evidence are under ignored `.cache/`. The production bundle contains generic `http://localhost` fallback literals inside React Router/Axios for non-browser contexts; these are not configured API destinations. No dependency code was modified to remove those inert literals.

Original attribution is restored in README and the upstream backend's `ISC` package declaration is unchanged. The inspected upstream has no root LICENSE file/copyright notice, so no replacement license text or invented author attribution was added. Confirm the upstream license text before choosing a project-wide license. [Upstream source](https://github.com/ankurdotio/interview-ai-yt).

## Executed tests

Executed on this Windows host with Node 24.12.0, real local MongoDB, and Chrome for Testing 156.0.8078.47 controlled by Puppeteer 25.16.0.

| Check | Result |
| --- | --- |
| Backend `npm test` | **PASS: 23 tests, 0 failures**, including legacy long-password login compatibility |
| Production bind/startup | **PASS:** actual child process bound `0.0.0.0` and honored the assigned test `PORT`; real database health request succeeded |
| Missing database startup | **PASS:** exits safely without logging the MongoDB URI |
| Production security tests | **PASS:** Secure cookie, origin rejection, missing-Origin write rejection, JWT algorithm/subject checks, private health/error behavior, POST logout, rate limiting |
| Backend integration | **PASS:** registration, password hashing, login, session lookup, logout invalidation, CORS, upload limits, real PDF extraction, ownership, Mongo-backed report retrieval, real Chrome PDF bytes; Gemini mocked in these tests |
| Frontend ESLint | **PASS** |
| Frontend production build | **PASS:** Vite 7.3.7, 114 modules |
| Render Blueprint schema | **PASS:** validated against Render's official Draft 2020-12 schema; this does not build the Linux image |
| Vercel config evaluation | **PASS:** supplied test Render origin generates API + SPA rewrites; missing, HTTP and trailing-slash origins reject; this is configuration evaluation, not a Vercel deployment |
| Development browser check | **PASS:** registration/login, session restoration, logout and visible input errors; AI skipped in that separate check |
| Production-build browser check through local proxy | **PASS:** homepage, registration, dashboard, cookie persistence, Log out button, login and same-origin API requests |
| Live Gemini after dependency/schema changes | **PASS locally:** actual interview report generated, listed and fetched from the database |
| Live PDF after dependency/browser changes | **PASS locally:** actual Download Resume button, HTTP 200, application/pdf, PDF signature and readable extracted text |
| Nested route refresh | **PASS locally:** compiled frontend refresh on the saved interview route |
| Browser safety checks | **PASS locally:** no uncaught browser errors, foreign-origin API requests, localhost API targets, Google key patterns or MongoDB URIs in loaded application bundles |
| Git source/history secret scan | **PASS:** Gitleaks plus private-value comparisons; repeat immediately before publication |

The successful production-build browser run is recorded under ignored `.runtime/deployment-*/results.json`, with its synthetic account, report identifier, screenshot and PDF. Earlier local preview attempts failed because the API allowed port 5173 while the preview used 4173; the verification process was corrected to use the exact preview origin. These failed attempts are retained in the private evidence directory. The successful browser check used an isolated local test database. The local preview uses HTTP and development-mode cookies; production Secure cookie flags were tested separately against the actual Express production configuration.

Test accounts/reports and isolated integration-test databases are retained; no test process drops a database or deletes existing records. Live verification used two Gemini requests with the existing privately configured key. No billing setting was changed.

## Required deployed tests — not executed yet

| Public deployment check | Status |
| --- | --- |
| Actual Vercel homepage and dashboard | NOT RUN |
| Registration, login, logout through Vercel -> Render | NOT RUN |
| Secure cookie persistence through Vercel external rewrite | NOT RUN |
| Actual Render -> Atlas connectivity and persistence | NOT RUN |
| Live Gemini through the deployed API | NOT RUN |
| Resume PDF on Render Linux and memory limit | NOT RUN |
| Vercel nested route refresh | NOT RUN |
| Deployed browser bundles/network contain no secrets or localhost API calls | NOT RUN |

Run from the project root only after the actual frontend URL is assigned:

```powershell
node scripts/verify-deployment.cjs https://<actual-vercel-production-origin> --ai
```

The script uses the public origin, exercises real browser forms and cookies, makes two AI calls, checks saved reports, refreshes the interview route, downloads/parses the resume PDF, and records private evidence. It creates synthetic records and does not delete them. Inspect the generated PDF visually as a final release check. A local run is not evidence that a cloud test passed.

## Remaining issues and release gates

- Await user approval for pushing prepared changes and creating/deploying external resources. No deployed URLs can be claimed yet.
- Atlas production credentials and Render outbound CIDRs still need private setup and actual connectivity testing.
- Render Linux image build and PDF execution are not yet verified. Free-instance memory/cold-start behavior is unmeasured.
- Vercel proxy configuration is evaluated locally; actual Origin/Cookie/Set-Cookie forwarding, no-cache behavior and SPA rewrites require the deployed test. Vercel's external-origin timeout is 120 seconds; AI requests now have a 60-second timeout with no automatic retries, but cold starts/rendering can still cause live timeouts. See [Vercel external target errors](https://vercel.com/docs/errors/router_external_target_error).
- Rate-limit counters are in-process and reset on restart; verify client IP behavior behind both platforms. Multiple replicas would need a shared limiter. Public registration can create additional accounts; configure appropriate Google project quotas before opening AI endpoints to public traffic. The current controls do not guarantee a spending cap.
- The existing blacklist collection has no retention cleanup; no TTL deletion or data migration was introduced. Existing laptop data and credentials were preserved.
- The local Node executable is an older Node 24 patch. Hosting should use the current patched 24.x release; no global software upgrade was performed.
- Resolve the missing upstream license/copyright text before adding a project-wide license. Attribution and existing license metadata have been preserved.

## Redeploying future code changes

1. Use Node 24.x. Install from lockfiles with `npm ci` in both packages when dependencies change. Start the local MongoDB listener required by integration tests.
2. Run backend `npm test`, frontend `npm run lint` and `npm run build`, and both npm audits. Run `node scripts/audit-security.cjs` and review staged files. The scanner requires the official, verified Gitleaks executable in ignored `.tools/gitleaks`.
3. Commit reviewed source and push to the agreed GitHub branch after the required publication approval. Preserve remote commits; do not force-push.
4. On Render, use Manual Deploy -> Deploy latest commit. If managed by a Blueprint with automatic sync disabled, plan and approve configuration changes separately. Environment-only changes also require a new deploy. Keep existing secret values unless a separately approved rotation is intended.
5. Vercel's Git integration normally deploys pushes to its production branch automatically. Otherwise choose Redeploy for the correct commit in the project. Keep root `Frontend` and `BACKEND_ORIGIN` unchanged unless the backend URL changed.
6. If the production frontend origin changes, update Render `FRONTEND_URL` and redeploy the API. If the backend origin changes, update Vercel `BACKEND_ORIGIN` and redeploy the frontend. Re-test login, session persistence, nested refresh and PDF after either change.
7. Re-run the public verification command, inspect logs/memory without exposing secrets, and update this report with actual URLs, commit IDs, test results and unresolved failures. Roll back to a known good deployment if release checks fail; do not delete the database to troubleshoot.
