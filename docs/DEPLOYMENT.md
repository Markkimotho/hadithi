# Hadithi deployment

- URL: https://hadithi-i2us.onrender.com
- Dashboard: https://dashboard.render.com/static/srv-db9vii7avr4c73fj59ng
- Workspace: `main` (`tea-db9rp46q1p3s739c1if0`), explicitly selected by the user.
- Service: `hadithi` (`srv-db9vii7avr4c73fj59ng`), Render Static Site.
- Source: `https://github.com/Markkimotho/hadithi`, branch `main`.
- Build: `npm ci && npm test && npm run build`.
- Published directory: `dist`.
- Automatic deployment: configured on commit, but no automatic deploy was observed after Git pushes. The release was deployed manually after verifying no deploy was queued. Check the service's Git provider connection before relying on auto-deploy.
- Secrets, runtime server, and databases: none required.

The service was created through Render's direct-creation connector. `render.yaml` is a separately validated provisioning reference; it does not automatically manage this service. Its `checksPass` deployment setting and custom headers must be applied through the Dashboard or a deliberately connected Blueprint. Review the existing service before creating another one. No custom-domain setup has been performed.

The application is a single entry point with relative ES modules and local artwork. It does not need a catch-all route. Browser saves remain on the player's browser; export/import is the portable backup path.

After an application change, push to `main` and inspect Render's deploy list. If a deploy is queued, follow it to `live` without triggering a duplicate. If no deploy appears, verify the service's Git provider connection; services linked using a public repository URL can require a manual deploy despite the auto-deploy setting. Trigger a manual deploy only after confirming there is no queued deployment for that change. Check the exact commit in Render's deploy record, then open a new journey, make an action, reload, resume, and verify both place and inventory. Verify all illustration requests succeed and the phone layout has no horizontal overflow. GitHub Actions independently runs engine tests, a production build, and desktop/phone browser tests.

The deployment has been verified with HTTP 200, three loaded stories, playable actions, an autosaved and resumed journey, restored inventory, local artwork, no page errors, and a phone viewport that fits. See `artifacts/live-desktop.png` for the generated smoke-test screenshot in the local workspace.

## Offline cache (second edition)

`npm run build` writes `dist/sw.js` with a cache name derived from a content hash of every shipped file and a precache list of all of them. The worker is network-first: online players always receive the newest deploy, the old cache is deleted on activation, and the cache answers only when the network fails. No Render setting is required. The existing `Cache-Control: no-cache` header keeps `sw.js` itself fresh.
