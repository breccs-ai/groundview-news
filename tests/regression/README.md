# Ground View regression suite

No dependencies beyond the project's own. Needs Node 18+ and, for the data and
security suites, the service-role key in `.env.local`.

```
node tests/regression/run.mjs                     units + live site + security + data
node tests/regression/run.mjs site                one suite
BASE_URL=https://staging.example node tests/regression/run.mjs site security
node tests/regression/run.mjs local               end-to-end flows (needs a dev server, below)
```

| Suite | What it checks | Touches data? |
|---|---|---|
| `units` | Prices, gambling detection, admin sessions, unsubscribe tokens, slugs, anti-spam, diffing, email templates | No |
| `site` | Every public page and article, redirects, sitemap, SEO tags, share images, links, security headers, certificate | No (read-only requests) |
| `security` | Admin/cron/webhook protection, anonymous access to APIs, public database key limits | Disposable `zz-` rows, removed afterwards |
| `data` | Article, writer, newsletter, outreach and ad data health; migrations in sync | Read-only |
| `local` | Admin sign-in, editor feedback workflow, both unsubscribe pages | Disposable `zz-` rows and your test writer account, restored afterwards |

Results:
- `PASS` / `FAIL`: a check that must hold. The runner exits 1 if any fail.
- `WARN`: needs attention but nothing is broken.
- `NOTE`: an observation, not a pass/fail.

The full result set is written to `tests/regression/results/last-run.json`.

## Running the local suite

```
ADMIN_PASSWORD=local-test-admin-pass UNSUBSCRIBE_TOKEN_SECRET=local-unsub-secret npx next dev -p 3100
node tests/regression/run.mjs local
```

The dev server uses the real database, so only run it with a clean tree and
never put a real password in `ADMIN_PASSWORD` for this. Email is never sent
(no Resend key locally).

Some checks assert today's real data (for example "every feedback round emailed
the writer"). If the data legitimately changes, adjust the check rather than
the data.
