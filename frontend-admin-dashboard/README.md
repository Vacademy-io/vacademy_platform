# Frontend Admin Dashboard

This is a modern admin dashboard built with React, TypeScript, and Tailwind CSS.

## Development

To start the development server:

```bash
pnpm install
pnpm dev
```

## Secrets / Environment Setup

This project uses Vite, so all client-exposed env vars must be prefixed with `VITE_`.

1. Copy the example env file and edit your local secrets/URLs:

```bash
cp env.example .env.local
```

2. Fill these essential variables in `.env.local`:

-   **VITE_BACKEND_URL**: Base URL for the backend API gateway (e.g., `https://backend.example.com`).
-   **VITE_LEARNER_DASHBOARD_URL**: Base URL of the learner app (used for links/redirects).
-   **VITE_ENGAGE_DOMAIN**: Hostname for live session/engage links (e.g., `engage.example.com`).
-   **VITE_SUPPORT_EMAIL**: Contact/support email shown in the UI.
-   **VITE_ADMIN_DOMAIN / VITE_LEARNER_DOMAIN / VITE_SHARED_DOMAIN**: Domains for SSO and cookies across subdomains. For local dev, you can usually keep defaults; for production set to your domains (e.g., `dash.example.com`, `learner.example.com/login`, `.example.com`).

3. Optional (feature-specific) variables you may set if using those features:

-   **VITE_ASSEMBLYAI_API_KEY**: Required for audio transcription features.
-   Diagnostics/telemetry: `VITE_APP_DISABLE_SENTRY`, `VITE_APP_GIT_SHA`.
-   Excalidraw/Library/backends: `VITE_APP_LIBRARY_BACKEND`, `VITE_APP_LIBRARY_URL`, `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_LP`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`.
-   Realtime/AI: `VITE_APP_AI_BACKEND`, `VITE_APP_WS_SERVER_URL`.
-   Misc debug/analytics: `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX`, `VITE_APP_ENABLE_TRACKING`, `VITE_WORKER_ID`.

4. Start the app:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build && pnpm serve
```

## Features

-   Modern UI with Tailwind CSS
-   TypeScript for type safety
-   React Query for data fetching
-   React Router for navigation
-   Zustand for state management
-   Husky for Git hooks
-   Prettier and ESLint for code formatting and linting

## Changes specifically for Holistic

-   Remove video, ai card, learning centre card (dashboard)
-   Add live class card (dashboard)
-   Role type only admin
-   Change SVGs

-   Hide columns (learners List)
-   Hide input fields (enroll learner)
-   Add columns (learners list)

-   hide subject (live class)
