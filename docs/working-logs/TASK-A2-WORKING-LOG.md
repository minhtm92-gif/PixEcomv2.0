# TASK-A2: ErrorBoundary + Request Timeout Safety

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-21                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `61a0e09`                                     |
| **Build**   | GREEN (13 routes, 0 TS errors)                |

---

## Summary

Added two safety features to the PixEcom v2 Seller Portal:

1. **React Error Boundary** — catches uncaught rendering errors in the portal and shows a recoverable fallback UI instead of a white screen.
2. **Request Timeout** — wraps every `apiClient` request with a 30-second `AbortController` timeout to prevent hung requests from blocking the UI.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/ErrorBoundary.tsx` | **Created** | Class component error boundary with fallback UI (error icon, "Something went wrong", Try Again + Reload buttons, collapsible technical details) |
| `apps/web/src/app/(portal)/layout.tsx` | **Modified** | Imported `ErrorBoundary` and wrapped `{children}` inside `<main>` with `<ErrorBoundary>` |
| `apps/web/src/lib/apiClient.ts` | **Modified** | Added `AbortController` with 30s default timeout, `timeout` option in `RequestOptions`, abort handling for both initial and retry requests |

---

## Decisions & Technical Notes

### ErrorBoundary

- **Class component required** — React error boundaries cannot be function components. This is the only class component in the project.
- **Placement**: Wraps `{children}` inside the portal `<main>` element, NOT around `<Sidebar>`. If a page crashes, the sidebar remains functional so the user can navigate away.
- **Recovery**: "Try again" button resets the error state, causing React to re-mount the child tree. "Reload page" does a full `window.location.reload()`.
- **Technical details**: Collapsed `<details>` element shows `error.message` for developer debugging without cluttering the user-facing UI.
- **Logging**: `componentDidCatch` logs both the error and React component stack to `console.error` for debugging.
- **Custom fallback**: Accepts an optional `fallback` prop for future use (e.g., different fallback per route group).

### Request Timeout

- **Default**: 30 seconds (`DEFAULT_TIMEOUT_MS = 30_000`). Configurable per-request via `opts.timeout`.
- **AbortController**: Created per request. On timeout, `controller.abort()` fires, `fetch` throws `DOMException` with `name === 'AbortError'`.
- **Error shape**: Timeout throws a standard `ApiError` with `code: 'REQUEST_TIMEOUT'`, `status: 0`, `message: 'Request timeout (30s)'`. This integrates cleanly with existing toast error handling.
- **Caller signal merging**: If the caller passes their own `AbortSignal` (e.g., for navigation cancellation), it is merged — aborting either signal cancels the request.
- **401 retry safety**: When a 401 triggers a token refresh + retry, the retry gets its own fresh `AbortController` with the same timeout duration.
- **Debug panel**: Timeout events are pushed to the debug instrumentation callback with `status: 0`.
- **No auth logic changes**: The timeout wraps around the existing refresh/retry flow without altering any authentication behavior.

---

## Testing Results

### Build Verification
```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (12/12)
             13 routes, 0 errors
```

### Route Output
```
○ /products                            2.52 kB
ƒ /products/[id]                       2.63 kB
○ /orders                              3.36 kB
ƒ /orders/[id]                         2.87 kB
○ /ads-manager                         4.07 kB
○ /analytics                           3.63 kB
○ /sellpages                           3.25 kB
ƒ /sellpages/[id]                      2.48 kB
○ /login                               2.57 kB
○ /debug/api                           3.71 kB
○ /debug/health                        2.03 kB
```

### Manual Verification Checklist
- [x] `ErrorBoundary.tsx` — class component, `getDerivedStateFromError`, `componentDidCatch`
- [x] Portal layout — `<ErrorBoundary>` wraps `{children}`, not `<Sidebar>`
- [x] `apiClient.ts` — `AbortController` created per request, `clearTimeout` on success/error
- [x] Timeout error has `code: 'REQUEST_TIMEOUT'` matching `ApiError` interface
- [x] Caller signal merging works (existing `signal` prop respected)
- [x] 401 retry gets fresh controller (no stale abort)
- [x] No auth logic changed (ensureSession, refresh, force-logout untouched)
