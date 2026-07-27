# Deploy notes
- 2026-07-27: asset filenames are stamped with CF_PAGES_COMMIT_SHA (vite.config.ts)
  so every deploy gets fresh URLs — see commit c5ee8f786 for the why (immutable
  edge/browser caching served stale same-name bundles). This file exists to touch
  the learner path when a redeploy with fresh asset URLs is needed.
