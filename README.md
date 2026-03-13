# ExpenseClaim Node Backend (Migration Scaffold)

This service is the new Node.js + MongoDB backend introduced for the Convex parallel-run migration.

## Current implementation
- Fastify app bootstrap
- MongoDB plugin + core models (`users`, `claims`, `claimCycles`)
- Migration control collections (`sync_cursor`, `reconcile_report`, `dual_write_audit`)
- Firebase token auth guard
- Health endpoint: `GET /health`
- Auth profile endpoint: `GET /api/v1/users/me`
- Login parity endpoints:
  - `GET /api/v1/users?onlyActive=true`
  - `GET /api/v1/users/email-registration?email=<email>`
- Claims read parity endpoints:
  - `GET /api/v1/claims/employee/summary`
  - `GET /api/v1/claims/employee/page?bucket=pending&page=1&pageSize=10`
  - `GET /api/v1/claims/admin/summary`
  - `GET /api/v1/claims/admin/page?bucket=pending&page=1&pageSize=10`
  - `GET /api/v1/claims/admin/payments-summary`
  - `GET /api/v1/claims/admin/finance-export`
  - `GET /api/v1/claims/:claimId`
  - `GET /api/v1/claims/:claimId/cycles`
  - `GET /api/v1/claims/:claimId/assets`

## Run locally
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## API contract notes
- `/api/v1/users/me` expects `Authorization: Bearer <Firebase ID token>`
- Returns shared contract shape from `shared/contracts/domain.ts`

## Next milestones
1. Harden parity contracts and add cross-source fixture comparisons
2. Implement claims write dual-write wave 1 (`create`, `approve`, `reject`)
3. Wire dual-write retry worker handlers for claim commands
4. Complete backfill/sync/reconciliation scripts beyond scaffold mode
