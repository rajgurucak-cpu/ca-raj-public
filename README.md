# CA RAJ Scanner Terminal

Express + SQLite backend that wraps the dark-purple scanner dashboard.

## Quick start

```bash
npm install
cp .env.example .env
node server.js
```

Open `http://localhost:3000`. The original 31 scanners are seeded on first boot
into `data/scanner.db`.

Admin panel: `http://localhost:3000/admin` — enter the `ADMIN_TOKEN` from
`.env`.

## Dev mode (default)

When the relevant env vars are missing, the app runs in a frictionless dev mode:

- **OTP**: `MSG91_AUTH_KEY` blank → OTPs are printed to the server console **and**
  echoed back in the `/api/auth/send-otp` response as `devOtp`. The frontend
  auto-fills the OTP grid and shows a "Dev mode" notice.
- **Razorpay**: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` blank → `/api/billing/create-order`
  returns a stub order with `devMode: true`. The frontend then calls
  `POST /api/billing/dev-activate` to instantly mark the subscription active.
  This dev endpoint is **disabled** when `NODE_ENV=production`.
- **Telegram**: optional. Each user supplies their own bot token + chat id via
  the in-app Telegram modal.

## Going to production

Edit `.env`:

```
NODE_ENV=production
JWT_SECRET=<32+ bytes of randomness>
ADMIN_TOKEN=<random token>
PUBLIC_BASE_URL=https://scanners.example.com

MSG91_AUTH_KEY=<from MSG91 dashboard>
MSG91_TEMPLATE_ID=<approved DLT template>
MSG91_SENDER_ID=CARAJX

RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<chosen secret, also configure in Razorpay dashboard>
```

In the Razorpay dashboard add a webhook pointing to
`POST {PUBLIC_BASE_URL}/api/webhook/razorpay` for the `payment.captured` event,
using the same secret as `RAZORPAY_WEBHOOK_SECRET`.

For Chartink, every scanner has a unique webhook URL visible in the admin
panel. Paste it into Chartink → Alerts → Webhook URL. The URL embeds the
per-scanner secret as `?secret=`.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/send-otp` | `{phone}`; rate limited 1/30s; dev returns `devOtp` |
| POST | `/api/auth/verify-otp` | `{phone, code}` → `{token, user, subscription}` |
| GET  | `/api/auth/me` | bearer token |
| GET  | `/api/scanners` | public — list with 24h match counts |
| GET  | `/api/scanners/:id` | public |
| GET  | `/api/scanners/:id/alerts?since=&limit=` | pro tier requires active sub |
| GET  | `/api/stream?token=` | SSE — alerts + 25s pings |
| POST | `/api/webhook/chartink/:id?secret=` | Chartink → bulk insert + SSE + Telegram |
| POST | `/api/webhook/razorpay` | HMAC-verified, raw body |
| POST | `/api/billing/create-order` | `{plan: 'monthly'|'yearly'|'lifetime'}` |
| POST | `/api/billing/dev-activate` | dev only |
| GET / POST | `/api/telegram/config` | per-user telegram settings |
| POST | `/api/telegram/test` | send test message |
| GET  | `/api/admin/scanners` | `X-Admin-Token` header |
| POST | `/api/admin/scanners` | create or update |
| DELETE | `/api/admin/scanners/:id` | |
| POST | `/api/admin/scanners/:id/rotate-secret` | |
| GET | `/api/admin/stats` | |

## Testing the Chartink webhook

```bash
# Find a scanner id + secret in the admin panel, then:
curl -X POST "http://localhost:3000/api/webhook/chartink/<id>?secret=<hex>" \
  -H 'content-type: application/json' \
  -d '{"stocks":"RELIANCE,TCS","trigger_prices":"2500,3500","triggered_at":"2:34 pm","scan_name":"test"}'
# → {"ok":true,"count":2}
```
