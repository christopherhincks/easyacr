# Production smoke test

Run these checks from a separate network after each deploy. Do not use a customer site for the first test; use a site you control.

1. `curl --fail --silent https://app.example.com/healthz` returns `{ "ok": true }`.
2. In Supabase Auth, set Site URL to `https://app.easyacr.com`, add `https://app.easyacr.com/tools` to Redirect URLs, and configure a production SMTP sender. Request a magic link for a test account and confirm the redirected `/tools` page creates an easyACR session.
3. Confirm terms, privacy, and acceptable-use pages render; accept the scan terms. A fresh session without acceptance must not register WebMCP or queue a scan.
4. Queue `https://your-controlled-site.example/` in the browser fallback. Confirm it reaches `completed`, `partial`, or a useful failure state after the worker claims it; verify its scan-history row and findings remain after restarting the app container.
5. In the approved WebMCP client, reload `/tools`, confirm exactly four tools are registered, start a scan, poll status, and read findings. Confirm an ordinary browser shows the fallback form instead.
6. Verify `https://127.0.0.1/`, a credentialed URL, `http://`, and an off-origin crawl attempt are rejected. Confirm three scans in a calendar day are accepted and the fourth is denied.
7. Revoke the browser scan session, restart the app container, and confirm that session remains unusable. Confirm Docker reports healthy `app`, `auth-gateway`, `data-gateway`, `scanner-egress`, and `scanner-worker` containers. Review logs for denied proxy attempts, worker errors, and unexpected restarts.

If any check fails, close public sign-up, preserve access-controlled logs, and resolve the cause before reopening.
