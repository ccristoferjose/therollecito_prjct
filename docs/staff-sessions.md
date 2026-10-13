# Staff sessions and kitchen refresh

Staff JWTs use `JWT_EXPIRES_IN`. The backend default and current local setting
are 12 hours; deployed environments can override this setting.

While a `/staff/kitchen` page is open, the browser checks the session every
15 seconds and renews it during the final five minutes of validity. For short
token lifetimes, the renewal window is a quarter of the lifetime. The refresh
endpoint requires a valid, unexpired staff JWT and rechecks the account's
active flag, role and location against the database. A disabled, deleted or
nonstaff account cannot renew. Transient renewal failures retry while the
token remains valid. An already expired token requires login, including after
the device sleeps through expiry.

Admin pages do not automatically renew sessions. At expiry they clear stored
credentials and redirect to login with a session-expired message. Authenticated
API responses with HTTP 401 also end the current session; responses for an
older token cannot invalidate a newly renewed session.

The live kitchen board receives socket events and polls every 30 seconds.
It also fetches orders after socket connection/reconnection, window focus,
network restoration and becoming visible. Socket listeners read current
callbacks so renewal does not leave them using an old token. Failed board
requests display a warning that the visible orders may be stale and offer a
manual refresh. This updates data without reloading the whole screen.

Deploy the backend refresh endpoint and frontend changes together. Existing
sessions that have already expired will need one new login. No database
migration is required.

Validation:

```sh
node --test backend/tests/auth.service.test.js backend/tests/payment.service.test.js
cd frontend-next
npm run type-check
# Start the local frontend first; these browser tests mock every API.
npx playwright test --config playwright.session.config.ts
```

Browser tests use a controlled clock to exercise expiry and renewal without
waiting for a shift. They cover admin expiry, kitchen renewal, saved expired
sessions, HTTP 401, connection failures and socket callbacks after renewal.
