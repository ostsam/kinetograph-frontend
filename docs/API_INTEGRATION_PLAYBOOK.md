# Kinetograph Frontend API Integration Playbook

This document is the implementation guide for moving the current editor from mixed mock/live behavior to fully API-backed behavior, and deploying the frontend on Vercel.

## Scope

- Frontend repo: `kinetograph-frontend` (Next.js 16 App Router)
- Backend contract source: `API.md` (FastAPI REST + WebSocket)
- Goal: no UX regression while replacing local mock actions with backend persistence

## Current Runtime Architecture (As Implemented)

### Live backend integration already in use

- `GET /api/assets` (initial assets load) via `KinetographAPI.getAssets()`
- `GET /api/pipeline/status` (phase bootstrap) via `KinetographAPI.getStatus()`
- `GET /api/paper-edit` (bootstrap + ws scripted states) via `KinetographAPI.getPaperEdit()`
- `POST /api/assets/upload` (upload attempt) via `KinetographAPI.uploadAsset()`
- `POST /api/pipeline/run` (creative prompt submit) via `KinetographAPI.runPipeline()`
- `POST /api/pipeline/approve` (commit sequence) via `KinetographAPI.approvePipeline()`
- `POST /api/paper-edit/reorder` (timeline drag reorder sync) via `KinetographAPI.reorderClips()`
- WebSocket `/ws` with reconnect + ping/pong via `useKinetographWS`

### Local/mock behavior currently still present

- Upload fallback to local blob assets when upload fails (`createLocalAsset`) in `AssetDropzone`
- Asset rename/delete are store-only (not persisted to backend)
- Add-to-timeline from bin is store-only (`addAssetToTimeline`)
- Clip delete/update are mostly local unless explicitly synced

This is a valid transitional setup for UI validation, but it is not yet API-authoritative.

## Integration Target State

Single source of truth is backend state.

- Every user mutation that should persist is sent to backend first (or optimistic with rollback).
- Frontend store mirrors backend responses/events.
- Mock paths are disabled in production.

## Backend Contract Checklist

Use this checklist with the backend team before final switch-over.

### Required and already documented in `API.md`

- `GET /api/assets`
- `POST /api/assets/upload`
- `GET /api/paper-edit`
- `PUT /api/paper-edit`
- `POST /api/paper-edit/clips`
- `PATCH /api/paper-edit/clips/{clip_id}`
- `DELETE /api/paper-edit/clips/{clip_id}`
- `POST /api/paper-edit/reorder`
- `POST /api/pipeline/run`
- `POST /api/pipeline/approve`
- `GET /api/pipeline/status`
- WebSocket: `connected`, `phase_update`, `awaiting_approval`, `pong`

### Potential contract gaps to resolve explicitly

1. Asset rename endpoint
- Current UI supports rename, but API.md does not define asset rename.
- Decision needed:
  - Add endpoint (recommended): `PATCH /api/assets/{asset_id}` with `{ file_name }`, or
  - Make assets immutable and disable rename UI in production.

2. Asset delete endpoint
- Current UI supports delete with confirmation, but API.md does not define asset delete.
- Decision needed:
  - Add endpoint (recommended): `DELETE /api/assets/{asset_id}`, or
  - Remove/disable asset delete UI in production.

3. Upload response shape
- Frontend type currently expects `RawAsset` from upload call, but then refreshes by `getAssets()` anyway.
- API.md sample upload response includes `status` wrapper fields.
- Recommendation: treat upload response as non-authoritative and keep `getAssets()` refresh as source of truth.

## File-by-File Migration Plan

### 1) API base URL + proxy strategy

Current:
- `src/lib/api.ts` uses `prefixUrl: '/api'`
- `next.config.ts` rewrites `/api/:path*` to `http://localhost:8080/api/:path*`

Target:
- Keep browser calls relative (`/api`) to avoid CORS exposure on the client.
- Make rewrite destination environment-driven for local, preview, and production.

Recommended `next.config.ts` pattern:

```ts
import type { NextConfig } from 'next';

const apiOrigin = process.env.KINETOGRAPH_API_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiOrigin) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

Notes:
- `KINETOGRAPH_API_ORIGIN` is server-side only (do not prefix with `NEXT_PUBLIC_`).
- Example values:
  - Local: `http://localhost:8080`
  - Prod: `https://api.kinetograph.yourdomain.com`

### 2) WebSocket URL strategy

Current:
- `src/hooks/use-kinetograph-ws.ts` builds URL from `window.location.protocol` + `NEXT_PUBLIC_WS_HOST` fallback `localhost:3000`

Issue:
- On Vercel, frontend host and backend ws host are usually different.

Target:
- Prefer a full explicit env var: `NEXT_PUBLIC_WS_URL` (e.g. `wss://api.kinetograph.yourdomain.com/ws`).
- Keep `NEXT_PUBLIC_WS_HOST` as backward-compatible fallback if desired.

Recommended logic:

```ts
const socketUrl = process.env.NEXT_PUBLIC_WS_URL
  ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${process.env.NEXT_PUBLIC_WS_HOST ?? window.location.host}/ws`;
```

### 3) Remove/flag mock ingest fallback

Current mock path:
- `src/components/asset-dropzone.tsx`
- on upload failure -> `createLocalAsset(file)`

Target:
- Production should fail loudly and show UI error if API upload fails.
- Keep mock fallback only behind explicit feature flag for local UI testing.

Recommended env flag:
- `NEXT_PUBLIC_ENABLE_LOCAL_MOCK_INGEST=true|false`

### 4) Persist timeline mutations to backend

Current:
- Reorder is synced.
- Add clip/delete clip/update clip are mostly local.

Target:
- `addAssetToTimeline` should call `POST /api/paper-edit/clips`
- clip edits should call `PATCH /api/paper-edit/clips/{clip_id}`
- clip delete should call `DELETE /api/paper-edit/clips/{clip_id}`
- keep optimistic updates with rollback on failure

Recommended sequence for each mutation:
1. Apply optimistic store update.
2. Execute API call.
3. On failure: rollback and surface non-blocking error.
4. Periodically reconcile with `GET /api/paper-edit` if drift is detected.

### 5) Decide behavior for asset rename/delete

If backend supports endpoints:
- Wire rename/delete actions from `AssetDropzone` to API and then refresh with `getAssets()`.

If backend does NOT support endpoints:
- Disable rename/delete controls in production build and leave them for mock mode only.

## Vercel Deployment Plan

## Prerequisites

- Backend deployed and reachable over HTTPS
- Backend CORS configured for frontend origins
- Backend WebSocket endpoint reachable over WSS

## Environment Variables (Vercel)

Set these in Vercel Project Settings for Preview and Production:

1. `KINETOGRAPH_API_ORIGIN`
- Example: `https://api.kinetograph.yourdomain.com`

2. `NEXT_PUBLIC_WS_URL`
- Example: `wss://api.kinetograph.yourdomain.com/ws`

3. Optional local/mock feature flags
- `NEXT_PUBLIC_ENABLE_LOCAL_MOCK_INGEST=false` (recommended in preview/prod)

## CORS and WebSocket origin requirements on backend

Allow origins for:
- Production frontend domain (e.g. `https://kinetograph.vercel.app` or custom domain)
- Preview domains if needed (e.g. `https://*.vercel.app` strategy as supported by backend framework)

If credentials/cookies are involved later:
- Do not use wildcard `*` origins with credentials.
- Enumerate exact allowed origins.

## Build/Runtime notes

- Frontend build runs in Vercel build environment; rewrites are resolved by Next runtime.
- WebSocket should be direct to backend (`NEXT_PUBLIC_WS_URL`) rather than relying on Next rewrites.
- If build fails fetching Google fonts in restricted CI, switch to local font hosting or keep network available for `next/font/google`.

## Rollout Strategy

1. Deploy backend with final contract.
2. Deploy frontend with mock fallback disabled in preview.
3. Run integration smoke tests (below).
4. Validate with realistic media and multi-clip timelines.
5. Promote to production.

## Integration Smoke Test Checklist

1. App bootstrap
- `/editor` loads
- assets and pipeline status fetch successfully
- ws connects and receives `connected`

2. Upload + bin
- upload video succeeds
- bin count increments
- selecting asset updates viewer

3. Timeline editing
- drag bin asset to timeline creates clip (persisted)
- reorder clips persists
- delete clip persists
- timeline duration and ruler reflect server data

4. Pipeline flow
- submit prompt -> pipeline starts
- ws phase updates render correctly
- `awaiting_approval` loads paper edit
- commit sequence resumes pipeline

5. Failure handling
- API 4xx/5xx paths show user feedback
- ws disconnect triggers reconnect

## Suggested Follow-Up Refactors (After API Cutover)

- Split store into `server-state` vs `ui-state` concerns to simplify rollback.
- Add a centralized API error handler + toasts.
- Add Playwright integration tests against a staged backend.
- Add runtime schema validation (`zod`) for API responses to catch contract drift early.

## Quick Mapping: UI Action -> Backend Call

- Import video: `POST /api/assets/upload` then `GET /api/assets`
- Rename asset: `PATCH /api/assets/{asset_id}` (if supported)
- Delete asset: `DELETE /api/assets/{asset_id}` (if supported)
- Add clip from bin: `POST /api/paper-edit/clips`
- Reorder clips: `POST /api/paper-edit/reorder`
- Update clip timing/transition: `PATCH /api/paper-edit/clips/{clip_id}`
- Delete clip: `DELETE /api/paper-edit/clips/{clip_id}`
- Commit sequence: `POST /api/pipeline/approve`

## Operational Recommendation

Treat preview deployments as contract verification gates.

- Backend PR -> deploy backend preview
- Frontend PR -> point `KINETOGRAPH_API_ORIGIN` + `NEXT_PUBLIC_WS_URL` at backend preview
- Block merge unless smoke tests pass end-to-end

That process will keep API/frontend drift low once teams move in parallel.
