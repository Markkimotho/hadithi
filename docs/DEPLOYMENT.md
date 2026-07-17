# Hadithi deployment

- URL: https://hadithi-i2us.onrender.com
- Dashboard: https://dashboard.render.com/static/srv-db9vii7avr4c73fj59ng
- Workspace: `main` (`tea-db9rp46q1p3s739c1if0`), explicitly selected by the user.
- Service: `hadithi` (`srv-db9vii7avr4c73fj59ng`), Render Static Site.
- Source: `https://github.com/Markkimotho/hadithi`, branch `main`.
- Build: `npm ci && npm test && npm run build`.
- Published directory: `dist`.
- Automatic deployment: on commit, configured through the connector.
- Secrets, runtime server, and databases: none required.

The service was created through Render's direct-creation connector. `render.yaml` is a separately validated provisioning reference; it does not automatically manage this service. Its `checksPass` deployment setting and custom headers must be applied through the Dashboard or a deliberately connected Blueprint. Review the existing service before creating another one. No custom-domain setup has been performed.

The application is a single entry point with relative ES modules and local artwork. It does not need a catch-all route. Browser saves remain on the player's browser; export/import is the portable backup path.

After an application change, push to `main` and follow the automatically created deploy to `live`. Do not trigger a second manual deployment for the same push. Check the exact commit in Render's deploy record, then open a new journey, make an action, reload, resume, and verify both place and inventory. Verify all illustration requests succeed and the phone layout has no horizontal overflow. GitHub Actions independently runs engine tests, a production build, and desktop/phone browser tests.

The deployment has been verified with HTTP 200, three loaded stories, playable actions, an autosaved and resumed journey, restored inventory, local artwork, no page errors, and a phone viewport that fits. See `artifacts/live-desktop.png` for the generated smoke-test screenshot in the local workspace.
