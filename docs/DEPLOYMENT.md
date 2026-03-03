# TeamKit Production Deployment

## Coolify Configuration

- **App UUID:** zso8oosgg8ccoksg0wcgwgcs
- **Project:** ThreeStack (ID: 54)
- **FQDN:** https://teamkit.threestack.io
- **Git repo:** https://github.com/ThreeStackHQ/teamkit
- **Branch:** main
- **Base dir:** /apps/web
- **Build pack:** nixpacks

## Environment Variables Required

The following env vars need to be configured in Coolify before deployment:

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Neon PostgreSQL | Create DB at neon.tech |
| `NEXTAUTH_SECRET` | ✅ Set | 32-char random string |
| `NEXTAUTH_URL` | ✅ Set | https://teamkit.threestack.io |
| `NODE_ENV` | ✅ Set | production |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth callback: .../api/auth/callback/google |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | |
| `GITHUB_ID` | GitHub Developer Settings | OAuth callback: .../api/auth/callback/github |
| `GITHUB_SECRET` | GitHub Developer Settings | |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhooks | Endpoint: .../api/stripe/webhook |
| `STRIPE_PRICE_INDIE` | Stripe Products | Indie plan $9/mo |
| `STRIPE_PRICE_PRO` | Stripe Products | Pro plan $29/mo |
| `RESEND_API_KEY` | resend.com | From: noreply@teamkit.threestack.io |
| `CRON_SECRET` | Generate random | For /api/cron/invites |

## Database Setup

```bash
# After setting DATABASE_URL in Coolify, run migrations:
pnpm --filter @teamkit/db drizzle-kit push

# Or run manually on Coolify start command:
# pnpm drizzle-kit migrate && pnpm start
```

## DNS Setup (Cloudflare)

Add A-record to threestack.io zone:
- Type: A
- Name: teamkit
- Value: 46.62.246.46
- Proxy: ✅ (proxied)

## Post-Deployment Smoke Tests

1. Sign up with Google or GitHub
2. Verify workspace auto-created
3. Invite a team member
4. Accept invitation via email link
5. Verify role change is logged in audit log
6. Test Stripe checkout

## Build Notes

The monorepo build requires pnpm with workspace dependencies.
Coolify install command handles pnpm installation.

## Status

- [x] Coolify application created
- [x] FQDN configured (teamkit.threestack.io)
- [x] Base env vars set (NEXTAUTH_URL, NEXTAUTH_SECRET, NODE_ENV)
- [ ] DATABASE_URL — needs Neon DB provisioned
- [ ] OAuth credentials — needs Google/GitHub setup
- [ ] Stripe credentials — needs Stripe account
- [ ] DNS A-record — needs Cloudflare setup (teamkit → 46.62.246.46)
- [ ] DEPLOY_ALL.sh — pending (Ruud, 60+ products queued)
