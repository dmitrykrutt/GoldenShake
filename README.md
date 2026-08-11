<div align="center">

# 🤝 GoldenShake

**A premium, invite-only, end-to-end encrypted messenger with a reputation economy and crypto escrow.**

`Django 4` · `Django Channels` · `DRF` · `Celery` · `PostgreSQL` · `Redis` · `Next.js 14` · `Tailwind CSS` · `PyNaCl`

</div>

---

## Table of contents

1. [What is GoldenShake?](#what-is-goldenshake)
2. [Feature tour](#feature-tour)
3. [Architecture](#architecture)
4. [Project layout](#project-layout)
5. [Quick start with Docker](#quick-start-with-docker)
6. [Local development without Docker](#local-development-without-docker)
7. [API keys — where to get every credential](#api-keys--where-to-get-every-credential)
8. [Environment variables](#environment-variables)
9. [REST API & WebSockets](#rest-api--websockets)
10. [The handshake economy](#the-handshake-economy)
11. [Garant escrow lifecycle](#garant-escrow-lifecycle)
12. [Testing](#testing)
13. [Production deployment](#production-deployment)
14. [Security model](#security-model)
15. [Troubleshooting](#troubleshooting)
16. [License](#license)

---

## What is GoldenShake?

GoldenShake is a closed, invitation-only messaging platform built for communities where
**trust is the product**. Every account is vouched for by an existing member, every message is
sealed with libsodium before it hits the database, and every trade can be escrowed by the
platform until both sides are satisfied.

The interface is deliberately austere — black `#0D0D0D`, graphite `#1C1C1E` and gold
`#C9A84C` / `#FFD700`.

## Feature tour

| Area | What you get |
| --- | --- |
| **Authentication** | Invite-only registration, provider-whitelisted e-mail, three-factor sign-in (passphrase + e-mail OTP + TOTP), Argon2 hashing, JWT sessions |
| **Messaging** | Realtime WebSocket chat, 1:1 and group rooms, replies, pins, read receipts, typing indicators, delete-for-me / delete-for-all |
| **Media** | Images, video, voice notes with waveform playback, arbitrary file attachments, S3/MinIO storage with pre-signed URLs |
| **Locked files** | Paywall any attachment behind a handshake-coin price; unlocked per user |
| **Calls** | WebRTC audio & video with a Channels-based signalling consumer and call logs |
| **Handshake economy** | Five coin rarities, forging (exchange), donations, invite rewards, ten reputation levels |
| **Garant escrow** | Private-link deals, CryptoPay invoices, 5 % platform fee, delivery confirmation, staff-arbitrated disputes |
| **Profiles & posts** | Public/private profiles, custom accent colour, social links, posts with likes, comments and shares |
| **Notifications** | In-app feed, Firebase push, SMTP e-mail, Telegram delivery, per-channel preferences |
| **Admin panel** | Support queue, verification review, dispute arbitration, bans, coin grants, platform statistics, audit log |
| **Compliance** | 18+ and ToS confirmation at signup, newsletter opt-in, GDPR data export |

## Architecture

```
                                   ┌──────────────┐
                     :80           │    nginx     │
   Browser  ────────────────────►  │ reverse proxy│
                                   └──┬────────┬──┘
                        /  (HTML)     │        │   /api/  /ws/
                    ┌──────────────◄──┘        └──►────────────────┐
                    │                                             │
            ┌───────▼────────┐                          ┌─────────▼─────────┐
            │   Next.js 14   │   REST + WebSocket       │  Django + Daphne  │
            │  Tailwind CSS  │ ───────────────────────► │  DRF · Channels   │
            └────────────────┘                          └──┬────┬────┬──────┘
                                                           │    │    │
                            ┌──────────────────────────────┘    │    └────────────┐
                            │                                   │                 │
                    ┌───────▼───────┐                  ┌────────▼──────┐  ┌───────▼──────┐
                    │  PostgreSQL   │                  │     Redis     │  │  S3 / MinIO  │
                    │   (15-alpine) │                  │ cache·layer·  │  │    media     │
                    └───────────────┘                  │    broker     │  └──────────────┘
                                                       └───────┬───────┘
                                                               │
                                                    ┌──────────▼──────────┐
                                                    │ Celery worker + beat│
                                                    │ e-mail·push·payouts │
                                                    └─────────────────────┘
```

## Project layout

```
goldenshake/
├── backend/
│   ├── apps/
│   │   ├── accounts/          # Users, invites, e-mail OTP, TOTP, verification
│   │   ├── chat/              # Rooms, encrypted messages, locked files, consumers
│   │   ├── calls/             # WebRTC signalling consumer + call logs
│   │   ├── coins/             # Handshake rarities, exchange, levels, ledger
│   │   ├── garant/            # Escrow deals, CryptoPay, disputes
│   │   ├── posts/             # Profile posts, likes, comments, shares
│   │   ├── notifications/     # In-app feed, FCM push, SMTP, Telegram, Celery tasks
│   │   └── admin_panel/       # Staff queues, moderation, statistics, audit log
│   ├── config/                # settings, asgi, wsgi, celery, urls, routing
│   ├── tests/                 # pytest-django suite
│   ├── requirements.txt
│   ├── conftest.py · pytest.ini · manage.py
│   ├── Dockerfile · entrypoint.sh
│   └── ...
├── frontend/
│   ├── components/            # Layout, ChatList, MessageBubble, MediaPlayer, badges…
│   ├── pages/                 # index, auth/*, chats/*, profile/*, garant/*, admin, …
│   ├── lib/                   # api client, WebSocket helper, auth context, constants
│   ├── styles/globals.css     # Tailwind + gold/dark theme, glassmorphism, scrollbar
│   ├── tailwind.config.js · next.config.js · Dockerfile
│   └── public/
├── nginx/nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quick start with Docker

**Prerequisites:** Docker 24+ and Docker Compose v2.

```bash
git clone https://github.com/<your-org>/GoldenShake.git
cd GoldenShake

# 1. Create your environment file
cp .env.example .env

# 2. Generate the two secrets you must not skip
python3 -c "from secrets import token_urlsafe; print('DJANGO_SECRET_KEY=' + token_urlsafe(50))"
python3 -c "import base64, os; print('MESSAGE_ENCRYPTION_KEY=' + base64.b64encode(os.urandom(32)).decode())"
# → paste both into .env

# 3. Build and start the whole stack
docker compose up -d --build

# 4. Watch it come up
docker compose logs -f backend
```

Migrations and `collectstatic` run automatically from `backend/entrypoint.sh`.

**Create the first account.** Registration requires an invite, so bootstrap a superuser and
generate one:

```bash
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
from apps.accounts.models import InviteLink
u = get_user_model().objects.filter(is_superuser=True).first()
print('Invite token:', InviteLink.objects.filter(creator=u).first().hash_token)
"
```

Then open <http://localhost/auth/register> and paste the token.

| Service | URL |
| --- | --- |
| Frontend | <http://localhost> |
| REST API | <http://localhost/api/v1/> |
| Swagger UI | <http://localhost/api/docs/> |
| ReDoc | <http://localhost/api/redoc/> |
| OpenAPI schema | <http://localhost/api/schema/> |
| Django admin | <http://localhost/django-admin/> |
| MinIO console | <http://localhost:9001> |

Useful commands:

```bash
docker compose ps                       # service health
docker compose logs -f celery           # task worker output
docker compose exec backend bash        # shell inside Django
docker compose down                     # stop
docker compose down -v                  # stop and wipe all data
```

## Local development without Docker

You need Python 3.11+, Node 18+, PostgreSQL 15 and Redis 7 running locally.

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp ../.env.example ../.env        # then set POSTGRES_HOST=localhost, REDIS_URL=redis://localhost:6379/0

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver         # HTTP + WebSocket via Channels' dev server
```

For a production-like ASGI server:

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Celery (two extra terminals):

```bash
celery -A config worker --loglevel=info
celery -A config beat   --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` and `NEXT_PUBLIC_WS_URL=ws://localhost:8000`
in your `.env` so the browser talks to Django directly instead of through nginx.

## API keys — where to get every credential

### 1. SMTP e-mail (required)

Only six providers may register, and this is **enforced server-side** in
`backend/apps/accounts/validators.py`:

```
gmail.com · yahoo.com · protonmail.com · tutanota.com · tutamail.com · mail.ru
```

| Provider | Host | Port | How to get the credential |
| --- | --- | --- | --- |
| Gmail | `smtp.gmail.com` | 587 | Enable 2FA, then create an **App password** at <https://myaccount.google.com/apppasswords> |
| Yahoo | `smtp.mail.yahoo.com` | 587 | Account Security → **Generate app password** |
| ProtonMail | `127.0.0.1` | 1025 | Install **Proton Mail Bridge** (paid plan) and use the credentials it prints |
| Tutanota | — | — | No SMTP; use another provider for outbound mail |
| Mail.ru | `smtp.mail.ru` | 587 | Settings → Security → **password for external applications** |

Fill in `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`.

### 2. CryptoPay (required for Garant escrow)

1. Open [@CryptoBot](https://t.me/CryptoBot) in Telegram.
2. Choose **Crypto Pay → Create App** and pick mainnet or testnet.
3. Copy the API token → `CRYPTOPAY_API_TOKEN`.
4. Set the app's webhook URL to `https://your-domain/api/v1/garant/webhook/cryptopay/`.
5. Put the same token in `CRYPTOPAY_WEBHOOK_SECRET` — incoming webhooks are HMAC-verified
   against it in `backend/apps/garant/cryptopay.py`.

Testnet base URL: `https://testnet-pay.crypt.bot/api`.

### 3. Telegram bot (SMS-style 2FA and alerts)

1. Message [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Copy the HTTP API token → `TELEGRAM_BOT_TOKEN`.
3. Users paste their numeric chat ID into **Settings → Profile → Telegram chat ID**
   (they can obtain it from [@userinfobot](https://t.me/userinfobot)).
4. Optionally set `TELEGRAM_SMS_CHAT_ID` to an ops channel for platform alerts.

### 4. Firebase Cloud Messaging (push notifications)

1. Create a project at <https://console.firebase.google.com>.
2. **Project settings → Service accounts → Generate new private key**.
3. Save the JSON beside `docker-compose.yml` as `firebase-credentials.json` (git-ignored).
4. Set `FCM_PROJECT_ID` and `FCM_CREDENTIALS_FILE=/app/firebase-credentials.json`, and mount
   the file into the `backend` and `celery` services.

### 5. S3 or MinIO (media storage)

* **MinIO (bundled):** already running at `http://minio:9000`. Set `USE_S3=true`,
  `AWS_S3_ENDPOINT_URL=http://minio:9000` and reuse the root credentials. Create the
  `goldenshake-media` bucket from the console at <http://localhost:9001>.
* **AWS S3:** create a bucket, then an IAM user with `s3:PutObject`, `s3:GetObject` and
  `s3:DeleteObject` on it at <https://console.aws.amazon.com/iam/>. Leave
  `AWS_S3_ENDPOINT_URL` empty.

Leaving `USE_S3=false` stores uploads on the local filesystem under `backend/media/`.

## Environment variables

Every variable is documented inline in [`.env.example`](.env.example). The ones you
**must** change before going live:

| Variable | Why |
| --- | --- |
| `DJANGO_SECRET_KEY` | Signs sessions and tokens |
| `MESSAGE_ENCRYPTION_KEY` | Encrypts every message body — **rotating it destroys history** |
| `POSTGRES_PASSWORD` | Database credential |
| `DJANGO_DEBUG=false` | Never expose tracebacks |
| `DJANGO_ALLOWED_HOSTS` | Your real domain(s) |
| `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` | Locks the API to your own frontend |
| `SECURE_SSL_REDIRECT` / `SECURE_HSTS_SECONDS` | Enable once TLS terminates in front |

## REST API & WebSockets

Interactive documentation is generated by **drf-spectacular** and served at
`/api/docs/` (Swagger UI) and `/api/redoc/`.

### REST namespaces

| Prefix | Purpose |
| --- | --- |
| `/api/v1/accounts/` | register, e-mail confirm, login, TOTP, profiles, invites, verification |
| `/api/v1/chat/` | rooms, messages, pinned chats, support tickets |
| `/api/v1/calls/` | call logs, ICE servers |
| `/api/v1/coins/` | balance, exchange, transactions, donate, levels |
| `/api/v1/garant/` | deals, private-link lookup, payment, disputes, CryptoPay webhook |
| `/api/v1/posts/` | posts, likes, comments, shares |
| `/api/v1/notifications/` | feed, device tokens, preferences |
| `/api/v1/admin-panel/` | staff queues, moderation, statistics (staff only) |

### Sign-in flow

```http
POST /api/v1/accounts/login/request-code/   { identifier, password }        → e-mails a 6-digit OTP
POST /api/v1/accounts/login/                { identifier, password,
                                              email_code, totp_code }     → { access, refresh, user }
POST /api/v1/accounts/token/refresh/        { refresh }                   → { access, refresh }
```

Authenticate every subsequent request with `Authorization: Bearer <access>`.

### WebSocket endpoints

| Path | Purpose | Client actions |
| --- | --- | --- |
| `/ws/chat/<room_id>/` | Realtime messaging | `send_message`, `delete_message`, `pin_chat`, `pin_message`, `typing`, `read_receipt`, `unlock_file` |
| `/ws/calls/<room_id>/` | WebRTC signalling | `call_start`, `offer`, `answer`, `ice_candidate`, `call_accept`, `call_decline`, `call_end` |
| `/ws/presence/` | Online status | `heartbeat` |
| `/ws/notifications/` | Live notification feed | *(server push only)* |

Authenticate by appending `?token=<access-jwt>`, by sending an
`Authorization: Bearer <access>` header, or via the `Sec-WebSocket-Protocol` header.
Close codes: **4401** = unauthenticated, **4403** = not a participant.

```js
const socket = new WebSocket(`ws://localhost/ws/chat/${roomId}/?token=${accessToken}`);
socket.onmessage = (event) => console.log(JSON.parse(event.data));
socket.send(JSON.stringify({ action: 'send_message', content: 'Hello', message_type: 'text' }));
```

## The handshake economy

Five rarities, each forged from the one below it:

| Rarity | Colour | Forged from |
| --- | --- | --- |
| 🟢 Green | `#3FB950` | earned directly |
| 🔵 Blue | `#3B82F6` | 50 green |
| 🟣 Purple | `#A855F7` | 10 blue |
| 🔴 Red | `#EF4444` | 10 purple |
| 🟡 Gold | `#FFD700` | 10 red |

Coins are earned by inviting members (10 green per accepted invite), receiving donations and
completing garant deals. Your **level** is derived from your balances — ten tiers from
`green` through `gold_plus` — and is rendered as the badge next to your name.

```http
GET  /api/v1/coins/balance/         → balances, level, progress to next level
POST /api/v1/coins/exchange/        { target_rarity, count }
POST /api/v1/coins/donate/          { recipient_username, rarity, amount, room_id?, memo? }
GET  /api/v1/coins/transactions/    → paginated ledger
```

## Garant escrow lifecycle

```
 seller creates deal        buyer opens private link        buyer pays CryptoPay invoice
        │                            │                                │
        ▼                            ▼                                ▼
   awaiting_buyer  ──agree──►  awaiting_payment  ──webhook──►       paid
                                                                      │
                                       seller marks delivered ────────┘
                                                  │
                                                  ▼
                                        completed_by_seller
                                                  │
                                     buyer confirms │           either side disputes
                                                  ▼                     │
                                             confirmed                  ▼
                                                  │                 disputed
                                     release_funds_task                 │
                                                  ▼         staff arbitration in /admin
                                             released  ◄─────────────────┘  or  refunded
```

The platform keeps `GARANT_PLATFORM_FEE_PCT` (default **5 %**); the seller receives the rest.
Agreeing to a deal automatically opens a two-person **guarantee chat** that staff can read
when a dispute is filed.

## Testing

```bash
cd backend
.venv/bin/python -m pytest              # full suite
.venv/bin/python -m pytest tests/test_auth.py -v
.venv/bin/python -m pytest -k garant
```

Tests run against `config/settings_test.py` (SQLite, in-memory Channels layer, eager Celery,
locmem e-mail) so **no PostgreSQL or Redis is required**. Coverage includes registration and
the invite system, the three-factor login flow, e-mail domain whitelisting, coin earning and
forging, message encryption round-trips, chat REST + WebSocket behaviour and the full garant
deal lifecycle.

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Production deployment

1. **DNS & TLS.** Point your domain at the host and terminate TLS — either add a `certbot`
   sidecar to `nginx`, or put a managed load balancer in front.
2. **Harden `.env`.** `DJANGO_DEBUG=false`, real `DJANGO_ALLOWED_HOSTS`, `SECURE_SSL_REDIRECT=true`,
   `SECURE_HSTS_SECONDS=31536000`, and `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS`
   set to your `https://` origin.
3. **Frontend origins.** Rebuild the frontend image with
   `NEXT_PUBLIC_API_URL=https://your-domain` and `NEXT_PUBLIC_WS_URL=wss://your-domain`
   (they are baked in at build time).
4. **Storage.** Set `USE_S3=true` and point at a real bucket so media survives redeploys.
5. **Scale.** `docker compose up -d --scale backend=3 --scale celery=2` — Channels shares
   state through Redis, so Daphne scales horizontally.
6. **Back up.** Snapshot the `postgres_data` volume and store `MESSAGE_ENCRYPTION_KEY` in a
   secrets manager; without it your database is unreadable.
7. **Observe.** `/health/` returns a JSON readiness probe; nginx access logs use a
   latency-annotated format.

## Security model

* **Transport:** TLS at the edge, HSTS, `SECURE_SSL_REDIRECT`, secure cookies.
* **At rest:** message bodies are XSalsa20-Poly1305 sealed (`PyNaCl`) before insertion —
  the `content` column stores ciphertext, never plaintext. Search is metadata-only by design.
* **Passwords:** Argon2id (`django[argon2]`) with Django's validators.
* **Sessions:** short-lived JWT access tokens with rotating refresh tokens and blacklisting.
* **Two-factor:** e-mail OTP **and** TOTP (`pyotp`, QR provisioning via `qrcode`) on every login.
* **Registration:** invite-gated, provider-whitelisted, 18+ and ToS confirmation required.
* **Abuse:** `django-ratelimit` plus DRF throttles on auth endpoints; nginx `limit_req` on `/api/`.
* **Escrow:** CryptoPay webhooks are HMAC-SHA256 verified; funds only move through Celery tasks.
* **Privacy:** GDPR export endpoint, private profiles, delete-for-all, per-user unlock records.

> **Never commit `.env` or `firebase-credentials.json`.** Both are listed in `.gitignore`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `django.db.utils.OperationalError` on start | PostgreSQL is not ready — `docker compose logs db`; the entrypoint waits 60 s |
| WebSocket closes with **4401** | The JWT is missing or expired — refresh it and reconnect |
| WebSocket closes with **4403** | The user is not a participant of that room |
| Registration rejects your e-mail | Only the six whitelisted providers are accepted |
| No e-mails arrive | Use an **app password**, not your account password; check `docker compose logs celery` |
| Push notifications silent | `FCM_CREDENTIALS_FILE` must be mounted into both `backend` and `celery` |
| CryptoPay webhook ignored | `CRYPTOPAY_WEBHOOK_SECRET` must equal the app token, and the URL must be publicly reachable |
| Media 404s | Create the bucket in MinIO, or set `USE_S3=false` for local storage |
| Frontend calls the wrong host | `NEXT_PUBLIC_*` is baked in at build time — rebuild the image |

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.
