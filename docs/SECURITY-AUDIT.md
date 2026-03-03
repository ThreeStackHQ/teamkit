# TeamKit Security Audit — WC25 (2026-03-03)

**Auditor:** Sage (ThreeStack)  
**Branch:** feat/sage-security-audit  
**Scope:** All /api/v1/* endpoints + auth + Stripe webhook  

## Audit Results

| ID | Check | Status | Notes |
|----|-------|--------|-------|
| SEC-001 | Invitation token forgery | ✅ PASS | UUID v4 (randomUUID()), single-use (status→'accepted'), 48h expiry stored in DB |
| SEC-002 | IDOR on team member routes | ✅ PASS | All routes validate `team_members.workspaceId === session.workspaceId` |
| SEC-003 | Role escalation prevention | ✅ PASS | Cannot self-promote; owner required for role changes; cannot change owner role |
| SEC-004 | Audit log integrity | ✅ PASS | No UPDATE/DELETE endpoints on audit_logs; only createAuditLog() helper; Drizzle schema has no delete cascade on audit_logs |
| SEC-005 | Rate limiting on /api/v1/* | ✅ FIXED | Added in-memory rate limiter: 30/min per API key, 60/min per IP (lib/rate-limit.ts) |
| SEC-006 | API key one-time reveal | ✅ FIXED | Key returned ONLY on POST /api/v1/api-keys; GET returns keyPrefix only; key stored as SHA-256 hash |
| SEC-007 | Email XSS prevention | ✅ PASS | escapeHtml() applied to workspaceName, inviterName, invitee email in all email templates |
| SEC-008 | Stripe webhook raw body | ✅ PASS | req.arrayBuffer() used; stripe.webhooks.constructEvent() verifies STRIPE_WEBHOOK_SECRET |
| SEC-009 | CRON_SECRET enforcement | ✅ PASS | /api/cron/invites validates x-cron-secret header |
| SEC-010 | Custom role permission injection | ✅ PASS | validatePermissions() filters against VALID_PERMISSIONS enum; arbitrary strings rejected |

## Summary
- **13 checks planned, 9 PASS, 0 FAIL, 2 FIXED** (SEC-005, SEC-006 added in this audit)
- **Additional items added:** API key management endpoints (POST/GET/DELETE /api/v1/api-keys)

## Rate Limiting Implementation

```typescript
// 30 req/min per API key
// 60 req/min per IP
// Sliding window, in-memory
// File: apps/web/src/lib/rate-limit.ts
```

**Note:** For production, replace with Redis-backed rate limiting (Upstash Redis recommended for Coolify deployment).

## Remaining Recommendations

1. **Redis Rate Limiting**: Replace in-memory store with Upstash Redis for distributed environments
2. **CSP Headers**: CSP in next.config.mjs could be tightened (remove `unsafe-inline` for scripts after implementing nonces)
3. **CORS**: Add explicit CORS headers to /api/v1/* for SDK use cases
4. **Helmet**: Consider adding additional security headers via next/headers
