# Vimotion — Feature Reference

Vimotion is the standalone product surface for AI-generated video inside the Vacademy admin dashboard. It lives at `/vim/*` and is its own self-contained shell: signup, login, dashboard, asset library, avatars, brand kits, and a full-screen video editor. Underneath it reuses the existing `video-api-studio` workspace (the "Create" tab) and the `ai-video-editor` component (the editor route), wrapped in a vim-branded chrome with vim-specific data sources (saved avatars, brand kits, vim API key auto-provisioning).

Vimotion users are an isolated tenant cohort — sign-up creates a fresh institute tagged `product = 'vimotion'` with an ADMIN role; login is plain email + password against the vacademy `User` table.

---

## 1. Frontend

### 1.1 Top-level layout

```
frontend-admin-dashboard/
└── src/
    ├── routes/vim/                              # TanStack Router route files (thin)
    │   ├── index.tsx                            # /vim          → redirects
    │   ├── login.tsx                            # /vim/login
    │   ├── onboarding/index.tsx                 # /vim/onboarding
    │   ├── dashboard.tsx                        # /vim/dashboard
    │   └── edit/$videoId/
    │       ├── index.tsx                        # /vim/edit/:videoId  (search params)
    │       └── index.lazy.tsx                   # /vim/edit/:videoId  (component)
    │
    ├── features/vimotion/                       # Vim-specific feature code
    │   ├── api/                                 # axios clients + types
    │   ├── auth/                                # LoginForm, OutputShowcase
    │   ├── avatars/                             # fal.ai built-in avatar catalog
    │   ├── composer/                            # Vim selectors used inside the Create tab
    │   ├── dashboard/                           # DashboardLayout, tabs, drawers
    │   ├── onboarding/                          # 4-step wizard
    │   ├── tour/                                # Joyride tours (per-tour seen flag)
    │   └── constants.ts                         # Account type + company size options
    │
    └── components/ai-video-editor/              # Shared video editor (used by /vim/edit too)
        ├── VideoEditorPage.tsx                  # Editor shell
        ├── EditorCanvas.tsx                     # Main canvas + handles
        ├── EntryListPanel.tsx                   # Shot list (left)
        ├── PropertiesPanel.tsx                  # Right panel with tabs
        ├── TimelineScrubber.tsx                 # Timeline + waveform
        ├── AudioTracksPanel.tsx                 # Music + voiceover tracks
        ├── AddShotDialog.tsx, AddMediaOverlayDialog.tsx
        ├── MonacoHtmlEditor.tsx                 # HTML tab (Monaco)
        ├── LayerHandlesOverlay.tsx              # Drag/scale/rotate handles
        ├── playback/, stores/, utils/           # Engine, store, helpers
```

### 1.2 Routes

| Path | File | Component | Purpose |
| --- | --- | --- | --- |
| `/vim` | [routes/vim/index.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/vim/index.tsx) | (redirect-only) | `beforeLoad` reads cookies and redirects to `/vim/dashboard` if authed, else `/vim/onboarding`. |
| `/vim/login` | [routes/vim/login.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/vim/login.tsx) | `LoginForm` | Email + password sign-in. Redirects to `/vim/dashboard` if already authed. |
| `/vim/onboarding` | [routes/vim/onboarding/index.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/vim/onboarding/index.tsx) | `OnboardingWizard` | 4-step signup wizard (Contact → OTP → Account type → Studio details). |
| `/vim/dashboard` | [routes/vim/dashboard.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/vim/dashboard.tsx) | `DashboardLayout` | Authenticated shell — sidebar + tabs (`?tab=create\|recent\|assets\|avatars\|brand-kits`). Also serves "production view" when `?videoId=...`. |
| `/vim/edit/:videoId` | [routes/vim/edit/$videoId/index.lazy.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/vim/edit/$videoId/index.lazy.tsx) | `VideoEditorPage` | Full-screen AI video editor for a single rendered video. |

`index.tsx` for the edit route just validates the search params (`htmlUrl`, `audioUrl`, `wordsUrl`, `avatarUrl`, `apiKey`, `orientation`, `focusTime`); the `.lazy.tsx` companion mounts the actual component lazily.

### 1.3 Onboarding flow — `/vim/onboarding`

A 4-step wizard. State lives in a Zustand store ([features/vimotion/onboarding/store.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/store.ts)). Each step is a separate component under `onboarding/steps/`.

Validation: Zod schemas in [onboarding/schema.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/schema.ts).

| # | Step | File | Inputs | API call | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | **Contact** | [ContactStep.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/steps/ContactStep.tsx) | Full name, work email, WhatsApp number, password (≥8 chars) | `POST /auth-service/v1/vimotion/request-signup-otp` | OTP sent on WhatsApp; advances to step 2. |
| 2 | **OTP** | [OtpStep.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/steps/OtpStep.tsx) | 6-digit numeric OTP | `POST /auth-service/v1/vimotion/verify-signup-otp` | Returns a `signup_token` (JWT, 15-min TTL) bound to phone+email; stored in onboarding store; advances. |
| 3 | **Account type** | [AccountTypeStep.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/steps/AccountTypeStep.tsx) | `individual` / `studio` / `agency` | If `individual`: `POST /auth-service/v1/vimotion/signup` immediately; tokens set in cookies, redirect `/vim/dashboard`. Else: advance to step 4. | — |
| 4 | **Studio details** | [StudioDetailsStep.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/steps/StudioDetailsStep.tsx) | Studio name (required), team size, optional logo (S3 upload via `ImageUploadField`), brand color (`ColorPickerField`) | `POST /auth-service/v1/vimotion/signup` | Tokens set, store reset, redirect `/vim/dashboard`. |

Header shows a `Stepper` with current step (filled dots), an `OnboardingBanner` doesn’t mount here — only on the dashboard once the user is authed. Right side is the form panel; left side is `BrandPanel` (marketing strip).

Guard: if the user refreshes mid-wizard on step 3 or 4 and the `signup_token` is gone, the wizard kicks them back to step 1.

### 1.4 Login — `/vim/login`

[LoginForm.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/auth/LoginForm.tsx)

- Two-column layout: left = `OutputShowcase` (Cloudinary-hosted hero clips); right = the form.
- Fields: `email` (required), `password` (required). React Hook Form + Zod.
- `POST /auth-service/v1/vimotion/login` → on success sets `accessToken` and `refreshToken` cookies (via `setAuthorizationCookie` with `TokenKey.accessToken / refreshToken`), routes to `/vim/dashboard`.
- 401 surfaces the friendly “Email or password is incorrect” toast.
- Link below the form: “New to Vimotion? Create an account” → `/vim/onboarding`.

### 1.5 Dashboard shell — `/vim/dashboard`

[DashboardLayout.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/DashboardLayout.tsx)

```
┌─────────┬──────────────────────────────────────────┐
│ Sidebar │ Topbar (tab title + credits pill)        │
│         ├──────────────────────────────────────────┤
│ Create  │                                          │
│ Recent  │   Main area                              │
│ Assets  │   - "full-bleed" for Create tab          │
│ Avatars │     and production view (?videoId=…)     │
│ Brand   │   - "max-w-5xl + p-8" for the rest       │
│  Kits   │                                          │
│         │                                          │
│ ───     │                                          │
│ Credits │                                          │
│ Help    │                                          │
│ Logout  │                                          │
└─────────┴──────────────────────────────────────────┘
```

Tab state is in the URL (`?tab=...`). Five tabs (defined in [tabsConfig.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/tabsConfig.ts)):

| Tab id | Label | Description (Topbar) | Component |
| --- | --- | --- | --- |
| `create` | Create | Describe your video — we’ll handle script, voice, visuals, and render. | `<VideoConsoleWorkspace vimMode />` (reused from `video-api-studio`) |
| `recent` | Recent | Videos you and your studio have generated. | [RecentTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/RecentTab.tsx) |
| `assets` | Assets | Indexed institute footage and imagery — drop into any video. | [AssetsTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/AssetsTab.tsx) |
| `avatars` | Avatars | Saved hosts you can drop into any video. | [AvatarsTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/AvatarsTab.tsx) |
| `brand-kits` | Brand Kits | Palette, fonts, layout, and intro/outro/watermark — bundled and swappable. | [BrandKitsTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/BrandKitsTab.tsx) |

`?videoId=<id>` opens a **production view** of one video inside the dashboard (reuses `VideoConsoleWorkspace` with `initialVideoId`); the "Edit" button there routes to `/vim/edit/:videoId`.

#### 1.5.1 Sidebar
[Sidebar.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/Sidebar.tsx)

- Header: Vimotion sparkle icon + studio name (from `useStudioName` → `GET .../institute/{id}` lite call).
- Nav: 5 buttons (Create, Recent, Assets, Avatars, Brand Kits) with active highlight.
- Bottom block:
  - `AiCreditsPanel` (shared) — wraps a `CreditsCardTrigger` showing current_balance / total_credits and a usage bar (red when low).
  - `HelpMenu` — opens a dropdown to replay any of the 5 tours.
  - Logout — `removeCookiesAndLogout()` then `navigate('/vim/login')`.

#### 1.5.2 Topbar
[Topbar.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/Topbar.tsx) — current tab title + description on the left; rounded credits chip on the right.

#### 1.5.3 OnboardingBanner
[OnboardingBanner.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/OnboardingBanner.tsx)

Sticky banner above each non-full-bleed tab’s content. Auto-hides when:
- a default brand kit exists for this institute (queried via `GET .../brand-kits/default`), OR
- the user dismissed it (`localStorage` key `vimotion_onboarding_skipped_<instituteId>`).

CTA opens `BrandKitDrawer` pre-filled for create.

#### 1.5.4 Create tab — VideoConsoleWorkspace (vimMode)

The Create tab embeds `<VideoConsoleWorkspace vimMode showHistorySidebar={false} onEdit={...} />` from [routes/video-api-studio/-components/VideoConsoleWorkspace.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/video-api-studio/-components/VideoConsoleWorkspace.tsx). `vimMode` swaps two pieces of the composer:

- **Host tab**: replaces ad-hoc face-image upload with [VimSavedAvatarSelect.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/composer/VimSavedAvatarSelect.tsx) → grid of saved avatars (custom + Argil/VEED catalog). Emits `host.avatar.saved_avatar_id`. Backend resolver hydrates provider/face/voice.
- **Visuals tab**: replaces the Style + Branding accordions with [VimBrandKitSelect.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/composer/VimBrandKitSelect.tsx) → list of saved brand kits, auto-selects default. Emits `brand_kit_id`. Resolver hydrates palette/fonts/intro/outro/watermark and replaces institute defaults entirely.

`onEdit` is provided by DashboardLayout to route into `/vim/edit/:videoId` keeping the user inside vim chrome.

#### 1.5.5 Recent tab
[RecentTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/RecentTab.tsx)

- Grid of 3 columns of cards (per video) at lg.
- Data: `getRemoteHistory(apiKey, 20, 0)` against the external video API (`/external/video/v1/history`); auto-provisions API key via `useVimotionApiKey`.
- Card states: `completed` (green “Ready”, clickable into production view via `Link to=/vim/dashboard search={{ videoId }}`), `generating` (spinner), `pending`, `failed`.
- Empty state CTA → `/vim/dashboard?tab=create`.

#### 1.5.6 Assets tab
[AssetsTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/AssetsTab.tsx)

- Filter chips: All / Videos / Images.
- “Upload” opens a modal (`UploadModal`) accepting:
  - Video: MP4 / WebM / MOV, max 500 MB. Sub-mode `demo` or `podcast`.
  - Image: PNG / JPEG / WebP, max 10 MB. Sub-mode `photo` / `screenshot` / `diagram`.
- Upload flow: `useFileUpload` → S3 (`source = AI_INPUT_VIDEO|AI_INPUT_IMAGE`, public) → `createInputAsset(apiKey, { name, kind, mode, source_url })`. Poll progress on the grid via `refetchInterval` 5s while any asset has status in `PENDING|QUEUED|PROCESSING`.
- Each card shows preview (image src or muted `<video preload="metadata">` poster), status badge (Ready / xx% / Queued / Pending / Failed), and kind/mode chip.
- Click → opens a right-side `AssetDetailPanel` with metadata, source URL, and Delete.

Data source: external video API — `listInputAssets(apiKey)`, `createInputAsset`, `fetchImageMetadata`, `fetchVideoContext`, `deleteInputAsset` from `routes/video-api-studio/-services/input-asset.ts`.

#### 1.5.7 Avatars tab
[AvatarsTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/AvatarsTab.tsx)

- Grid of avatar cards (3 cols at lg). Each card: image preview (or initials with deterministic background color), name, optional provider badge (CUSTOM / ARGIL / VEED), voice/language descriptor.
- “New avatar” opens [AvatarDrawer.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/AvatarDrawer.tsx) (right-side Sheet) with two modes:
  - **Custom**: name, description, face image upload, voice picker (language, gender, tier, `voice_id` from `fetchTtsVoices`).
  - **Built-in**: name, description, browse the static catalog ([avatars/catalog.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/avatars/catalog.ts)) of Argil (28) + VEED (28) fal.ai avatars, voice picker.
- Per-card menu: Edit / Delete.
- API: `listAvatars`, `createAvatar`, `updateAvatar`, `deleteAvatar` ([api/avatars.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/avatars.ts)) → admin_core_service.

#### 1.5.8 Brand Kits tab
[BrandKitsTab.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/BrandKitsTab.tsx)

- Grid of kit cards: palette swatches (primary / secondary / accent / background), heading + body font line, `Default` chip when applicable.
- “New kit” opens [BrandKitDrawer.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/BrandKitDrawer.tsx). Drawer fields:
  - `name`, `isDefault` switch.
  - `backgroundType`: `white` (Light) / `black` (Dark).
  - Palette: 4 hex pickers (`ColorPickerField`).
  - `headingFont`, `bodyFont` from `FONT_OPTIONS`.
  - `layoutTheme` from `fetchVideoTemplates` catalog.
  - Logo upload (`ImageUploadField` → S3).
  - Intro (enabled, duration sec, html), Outro (enabled, duration sec, html).
  - Watermark (enabled, position TL/TR/BL/BR, opacity, html).
  - “Build kit from website” → `POST .../brand-kits/scrape` on the AI service (60s timeout) — scrapes a draft palette/logo/screenshot from a URL and prefills the drawer; the user reviews then saves with the normal `POST .../brand-kits`.
- Per-card menu: Edit / Set as default / Delete.
- API: `listBrandKits`, `getDefaultBrandKit`, `createBrandKit`, `updateBrandKit`, `setDefaultBrandKit`, `deleteBrandKit`, `scrapeBrandKitFromUrl` ([api/brandKits.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/brandKits.ts)).

### 1.6 Video editor — `/vim/edit/:videoId`

[VideoEditorPage.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/VideoEditorPage.tsx) (shared component, 762 lines)

The editor is shared with the non-vim `video-api-studio` flow. The vim wrapper ([routes/vim/edit/$videoId/index.lazy.tsx](vacademy_platform/frontend-admin-dashboard/src/routes/vim/edit/$videoId/index.lazy.tsx)) does three things:

1. Mounts a `VimTourProvider` so the editor tour can replay.
2. Overrides the "Back" handler to return to `/vim/dashboard?videoId=<id>` (the production view) instead of `/video-api-studio`.
3. Auto-starts the `vim-editor` Joyride tour after the timeline loads and a first entry is selected (polls store for entries up to 8s).

#### 1.6.1 Editor layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Toolbar:  Back │ Panel toggle │ 1920×1080 │ [Unsaved] ……         │
│                Undo Redo │ Add shot Add overlay │ Save Render Edit│
├─────────────┬──────────────────────────────────────┬─────────────┤
│             │                                      │             │
│ Entry list  │            Canvas                    │  Properties │
│   (shots)   │    (LayerHandlesOverlay)             │   (right)   │
│             │                                      │             │
├─────────────┴──────────────────────────────────────┴─────────────┤
│  PlaybackBar (play, time, vol)                                   │
│  TimelineScrubber (timeline + sentence waveform)                 │
│  AudioTracksPanel (music / extra VO)                             │
└──────────────────────────────────────────────────────────────────┘
```

State: a single Zustand store [stores/video-editor-store.ts](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts) (1215 lines) — `entries`, `selectedEntryId`, `dirtyEntryIds`, `deletedEntryIds`, `entryTransforms`, `past`/`future` (undo/redo), playback, audio tracks, save/render.

#### 1.6.2 Toolbar

- `Back` — `props.onBack()` (vim wrapper sets this to `/vim/dashboard?videoId=`). Confirms unsaved before leaving.
- Panel-left toggle — hide/show the EntryListPanel.
- Canvas dimensions badge (e.g. `1920×1080`).
- `Unsaved` badge when dirty.
- `Undo` / `Redo` — drives the store's `past`/`future` stack.
- `Add shot` (`FilePlus2`) — opens `AddShotDialog`.
- `Add media overlay` (`ImagePlus`) — opens `AddMediaOverlayDialog`.
- `Save` — `saveChanges()` → PATCH back to the external video API. Shows pending count badge.
- `Render` — opens `RenderSettingsDialog`; calls `requestVideoRender(videoId, apiKey, settings)`; polls `getRenderStatus(jobId, ...)` every 10 s up to 30 min. Resumable across reloads via `localStorage` key `render-job-<videoId>` (90-min TTL) and a server-side `getVideoUrls(videoId)` check. States: idle → submitting → rendering (with % progress bar) → done (Download MP4 button) | error (Retry).
- `Preview` / `Edit` — toggles between the live editor and a full-screen `AIContentPlayer` running the last saved timeline.

#### 1.6.3 Entry list (left)

[EntryListPanel.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/EntryListPanel.tsx) — vertical list of shots (each `Entry` has `inTime`, `exitTime`, `html`, derived transforms). Click to select → canvas focuses, timeline seeks, properties load. Eye icon marks the shot under the playhead. Per-row delete adds to `deletedEntryIds`.

#### 1.6.4 Canvas (center)

[EditorCanvas.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/EditorCanvas.tsx) renders the selected shot's HTML inside a sandboxed iframe agent ([utils/editor-iframe-agent.ts](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/utils/editor-iframe-agent.ts)) so script-heavy shots (gsap, anime, katex) stay isolated. Click any element to select a **layer**; [LayerHandlesOverlay.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/LayerHandlesOverlay.tsx) draws 8 resize handles + rotation handle. Drag to move, corner-drag to scale, rotate handle, arrow keys nudge (1 px) / shift-arrow (10 px).

Preconnect `<link rel="preconnect">` is injected for `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `code.iconify.design`, `fonts.googleapis.com`, `fonts.gstatic.com` to warm the TCP/TLS handshake before the first iframe pulls libraries.

#### 1.6.5 Properties panel (right)

[PropertiesPanel.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/PropertiesPanel.tsx) (1645 lines). When an entry is selected, it shows:

- Header: shot name + a `Remake with AI` button (`data-tour="editor-remake"`) — opens an inline prompt; submits a re-generation that only re-runs this single shot's HTML pass. Preview then accept or discard.
- Tabbed sub-panels (`data-tour="editor-properties-tabs"`):

  | Tab id | Label | What you can edit |
  | --- | --- | --- |
  | `layers` | **Layers** | DOM tree of the shot; toggle visibility, reorder, delete, click-to-select. Uses `LayersTab.tsx`. |
  | `transform` | **Transform** | x / y / scale / rotation of the selected layer. |
  | `motion` | **Motion** | Per-layer keyframe animations (intro / exit / loops). |
  | `text` | **Text** | Edit text content of selected text layer; font/size/color/weight. |
  | `media` | **Media** | Replace image / video src; alt; object-fit. |
  | `overlays` | **Overlays** | List of overlays added via the toolbar (text, image, video) — reorder, time-range, opacity, delete. |
  | `code` | **HTML** | Raw HTML for the shot in `MonacoHtmlEditor`. |

Each tab edits store state; commits flow into the dirty set and undo stack.

#### 1.6.6 Timeline + audio

- [TimelineScrubber.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/TimelineScrubber.tsx) (1010 lines) — scrubbable timeline; per-entry tracks, drag left/right edges to resize duration; below it the narration audio waveform is split into **sentence regions** (one per sentence). Click a region → opens `SentenceEditPopover` with the text; "Re-narrate" hits the TTS endpoint, splices the new audio into the source, re-times the rest of the video. Also: `SoundCueRemovePopover` for cue-based audio dips.
- [PlaybackBar.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/playback/PlaybackBar.tsx) — play/pause, current time, scrub. Underlying `playback-engine.ts` drives both iframe playback and audio scheduling.
- [AudioTracksPanel.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/AudioTracksPanel.tsx) — add background music or extra VO tracks. Per track: src, volume, delay, fade in/out, mute.

#### 1.6.7 Add Shot / Add Media Overlay dialogs

- [AddShotDialog.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/AddShotDialog.tsx) — describe a new shot, choose where to insert (before / after current); the backend re-renders only the new HTML.
- [AddMediaOverlayDialog.tsx](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/AddMediaOverlayDialog.tsx) — pick an image/video (from Assets tab) and drop it as a floating overlay on the current shot with a time range.

#### 1.6.8 Search params (deep-link)

`/vim/edit/:videoId` accepts:
- `htmlUrl` (required) — timeline HTML
- `audioUrl` — narration MP3
- `wordsUrl` — word-timing JSON (needed for sentence regions)
- `avatarUrl` — overlay avatar talking head
- `apiKey` — external video API key
- `orientation` — `landscape` / `portrait` (default `landscape`)
- `focusTime` / `t` — seconds; on mount the editor seeks here and selects the entry that contains this timestamp.

### 1.7 Joyride tours

[tour/VimTourProvider.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/tour/VimTourProvider.tsx) mounts a single Joyride instance for the vim shell. Five tours, each driven by `[data-tour="..."]` anchors and stored per institute in `localStorage` (`vim_tour_seen:<institute>:<tourId>`).

| Tour id | Triggered automatically on | Replay via Help menu |
| --- | --- | --- |
| `vim-dashboard` | First load of any tab other than Create | ✓ |
| `vim-composer` | First load of `?tab=create` | ✓ |
| `vim-brand-kit` | (Manual only from drawer / help menu) | ✓ |
| `vim-avatar` | (Manual only) | ✓ |
| `vim-editor` | First load of `/vim/edit/:videoId` after entries hydrate and one is selected | ✓ |

Step content (titles + body) is in [tour/steps.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/tour/steps.ts). HelpMenu ([tour/HelpMenu.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/tour/HelpMenu.tsx)) shows a green check next to seen tours.

### 1.8 Auto-provisioned external API key

[dashboard/hooks/useVimotionApiKey.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/dashboard/hooks/useVimotionApiKey.ts) auto-creates an external video API key for the institute named "Vimotion default" the first time the dashboard mounts. Resolution order:
1. `localStorage[vimotion_api_key_<instituteId>]` (full secret cached).
2. Otherwise call `generateApiKey(instituteId, 'Vimotion default')` and cache the returned secret.

This is what powers the Recent grid (`getRemoteHistory`), Assets tab (`listInputAssets`, `createInputAsset`), and the editor's save/render calls.

### 1.9 Zustand stores

| Store | File | Purpose |
| --- | --- | --- |
| `useVimotionOnboardingStore` | [onboarding/store.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/onboarding/store.ts) | `step`, `contact`, `signupToken/expiresAt`, `accountType`, `studio`. Drives the wizard. |
| `useVideoEditorStore` | [components/ai-video-editor/stores/video-editor-store.ts](vacademy_platform/frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts) | All editor state — entries, selection, transforms, dirty tracking, undo/redo, audio tracks, save/render. |

### 1.10 Constants & utilities

| File | Purpose |
| --- | --- |
| [features/vimotion/constants.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/constants.ts) | `COMPANY_SIZE_OPTIONS`, `ACCOUNT_TYPE_OPTIONS`, `isVimotionHost()` host detector. |
| [features/vimotion/avatars/catalog.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/avatars/catalog.ts) | Static catalog of 28 Argil + 28 VEED fal.ai built-in avatars; helpers `findCatalogEntry`, `getInitials`, `colorForInitials`. |
| [features/vimotion/api/types.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/types.ts) | Auth payload/response types (signup, OTP, login). |
| [features/vimotion/api/dashboardTypes.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/dashboardTypes.ts) | BrandKit + StudioAvatar TypeScript shapes including scrape result. |
| [features/vimotion/auth/OutputShowcase.tsx](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/auth/OutputShowcase.tsx) | Cloudinary-hosted marketing video tiles for the login left-pane. |

---

## 2. Backend

Two services own Vimotion data + auth:

- `auth_service` — sign-up OTP / signup / login (creates institute + ADMIN user).
- `admin_core_service` — brand kits and studio avatars (CRUD), scoped per institute.
- `ai_service` — brand kit scrape from URL (not persisted; returns draft). Out of scope for this doc (FE just POSTs and prefills).

### 2.1 auth_service: Vimotion auth

Base path: `/auth-service/v1/vimotion`

Controller: [VimotionAuthController.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/controller/VimotionAuthController.java)

| Method | Path | Body | Returns | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/request-signup-otp` | `{ phone_number }` | `string` (toast text) | Sends WhatsApp OTP via `NotificationService.sendPlatformDefaultWhatsAppOtp`. |
| POST | `/verify-signup-otp` | `{ full_name, email, phone_number, otp }` | `{ signup_token, expires_at }` | Verifies OTP through `NotificationService.verifyWhatsAppOTP`; on success issues a 15-min HS256 JWT (`purpose=vimotion-signup`, binds phone+email) via `VimotionSignupTokenService`. |
| POST | `/signup` | `{ signup_token, full_name, email, phone_number, password?, account_type, studio_name?, logo_file_id?, brand_color?, company_size? }` | `{ accessToken, refreshToken }` | Verifies signup token (phone+email must match the JWT claims); calls admin_core_service `internal/institute/v1/create` (HMAC-signed internal call) with `product='vimotion'`; upserts a `User` with `is_root_user=true`; attaches ADMIN role for the new institute; returns JWT pair. |
| POST | `/login` | `{ email, password }` | `{ accessToken, refreshToken }` | Plain email + password lookup; password compare is direct (the global `PasswordEncoder` is NoOp). Issues fresh refresh token and JWT pair. |

Auth manager: [VimotionAuthManager.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/manager/VimotionAuthManager.java)

Signup-token service: [VimotionSignupTokenService.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/service/VimotionSignupTokenService.java) — issues + verifies HS256 JWTs with 15-minute TTL; signed with `JwtService.secretKey`.

DTOs:
- [VimotionRequestOtpRequest.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/dto/VimotionRequestOtpRequest.java) — `phoneNumber`.
- [VimotionVerifyOtpRequest.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/dto/VimotionVerifyOtpRequest.java) — `fullName`, `email`, `phoneNumber`, `otp`.
- [VimotionVerifyOtpResponse.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/dto/VimotionVerifyOtpResponse.java) — `signupToken`, `expiresAt` (epoch ms).
- [VimotionSignupRequest.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/dto/VimotionSignupRequest.java) — full payload.
- [VimotionLoginRequest.java](vacademy_platform/auth_service/src/main/java/vacademy/io/auth_service/feature/auth/dto/VimotionLoginRequest.java) — `email`, `password`.
- All use `@JsonNaming(SnakeCaseStrategy)` so the wire is snake_case while Java uses camelCase.

Institute creation derives the institute name from `studio_name` (org accounts) or `full_name` (individual). `product='vimotion'`, `accountType` lowercased, `instituteLogoFileId/instituteThemeCode/companySize` set only for org accounts.

### 2.2 admin_core_service: Vimotion brand kits

Base path: `/admin-core-service/vimotion/v1/brand-kits`

Controller: [VimotionBrandKitController.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/controller/VimotionBrandKitController.java)

All endpoints require a JWT (`@RequestAttribute("user") CustomUserDetails user`) and an `instituteId` query param.

| Method | Path | Query | Body | Returns | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `` | `instituteId` | — | `List<BrandKitDTO>` | Ordered `is_default DESC, created_at DESC`. |
| GET | `/default` | `instituteId` | — | `BrandKitDTO` (200) or 404 | First brand kit flagged default. |
| GET | `/{id}` | `instituteId` | — | `BrandKitDTO` | |
| POST | `` | `instituteId` | `BrandKitDTO` | `BrandKitDTO` (201) | If `is_default=true` OR no existing kits: clears prior defaults first (partial unique index `uq_brand_kit_default_per_institute`), then inserts. |
| PUT | `/{id}` | `instituteId` | `BrandKitDTO` (partial) | `BrandKitDTO` | Null fields = leave unchanged. Promotion/demotion of `is_default` is honored. |
| POST | `/{id}/set-default` | `instituteId` | — | `BrandKitDTO` | Clears other defaults, sets this one. |
| DELETE | `/{id}` | `instituteId` | — | 204 | Hard delete. |

DTO: [BrandKitDTO.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/dto/BrandKitDTO.java)
- `id`, `name`, `isDefault` (boxed Boolean — null = unchanged on PUT)
- `backgroundType` (`white` | `black`)
- `palette` (`Map<String, Object>` — primary/secondary/accent/background)
- `headingFont`, `bodyFont`, `layoutTheme`, `logoFileId`
- `intro`, `outro` (`Map`: enabled/duration_seconds/html)
- `watermark` (`Map`: enabled/position/opacity/html/max_width/max_height/margin)
- `createdAt`, `updatedAt` (epoch ms)

Entity: [BrandKit.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/entity/BrandKit.java) — JPA `@Table("brand_kit")` with `JdbcTypeCode(SqlTypes.JSON)` for the four JSONB maps. `@PrePersist`/`@PreUpdate` normalizes nulls + defaults `backgroundType=white`.

Repository: [BrandKitRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/repository/BrandKitRepository.java) — finders + two `@Modifying` queries to clear defaults.

Service: [BrandKitService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/service/BrandKitService.java) — wraps the partial-unique-index dance in `@Transactional` create/update/setDefault.

### 2.3 admin_core_service: Vimotion studio avatars

Base path: `/admin-core-service/vimotion/v1/avatars`

Controller: [VimotionAvatarController.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/controller/VimotionAvatarController.java)

| Method | Path | Query | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `` | `instituteId` | — | `List<StudioAvatarDTO>` |
| GET | `/{id}` | `instituteId` | — | `StudioAvatarDTO` |
| POST | `` | `instituteId` | `StudioAvatarDTO` | `StudioAvatarDTO` (201) |
| PUT | `/{id}` | `instituteId` | `StudioAvatarDTO` (partial) | `StudioAvatarDTO` |
| DELETE | `/{id}` | `instituteId` | — | 204 |

DTO: [StudioAvatarDTO.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/dto/StudioAvatarDTO.java)
- `id`, `name`, `provider` (`custom` | `argil` | `veed`)
- `externalAvatarId` — fal.ai catalog enum value (Argil: `Mia outdoor (UGC)`; VEED: `emily_vertical_primary`); null for custom.
- `faceImageUrl` — required for `custom`; null for built-ins.
- `previewImageUrl` — for `custom` mirrors the face image; for built-ins null in v1 (FE renders initials).
- `description`
- TTS voice: `voiceId`, `voiceProvider` (`google`/`sarvam`/`edge`), `voiceLanguage`, `voiceGender`.
- `createdAt`, `updatedAt`.

Validation rules ([StudioAvatarService.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/service/StudioAvatarService.java)):
- Provider defaults to `custom`; must be one of `custom|argil|veed`.
- For `custom`, `faceImageUrl` is required.
- For built-ins, `externalAvatarId` is required; `faceImageUrl` is cleared.
- Provider switching is allowed; state is re-validated after merging the incoming changes.
- `previewImageUrl` is auto-derived from `faceImageUrl` for custom; left null for built-ins unless explicitly set.

Entity: [StudioAvatar.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/entity/StudioAvatar.java)
Repository: [StudioAvatarRepository.java](vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/vimotion/repository/StudioAvatarRepository.java) — `findByInstituteIdOrderByCreatedAtDesc`, `findByIdAndInstituteId`.

### 2.4 Database schema

Migrations:
- [V227__Create_vimotion_brand_kits_and_avatars.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V227__Create_vimotion_brand_kits_and_avatars.sql)
- [V228__Add_avatar_provider.sql](vacademy_platform/admin_core_service/src/main/resources/db/migration/V228__Add_avatar_provider.sql)

```sql
-- brand_kit
id              VARCHAR(64)  PK
institute_id    VARCHAR(255) FK → institutes(id)  -- NO ACTION on delete
name            VARCHAR(120)
is_default      BOOLEAN  DEFAULT FALSE
background_type VARCHAR(16)  DEFAULT 'white'      -- 'white' | 'black'
palette_json    JSONB    DEFAULT '{}'             -- { primary, secondary, accent, background }
heading_font    VARCHAR(64)
body_font       VARCHAR(64)
layout_theme    VARCHAR(64)                       -- ai_service VIDEO_TEMPLATES id
logo_file_id    VARCHAR(255)
intro_json      JSONB    DEFAULT '{}'             -- { enabled, duration_seconds, html }
outro_json      JSONB    DEFAULT '{}'
watermark_json  JSONB    DEFAULT '{}'             -- { enabled, position, opacity, html, max_width?, max_height?, margin? }
created_by      VARCHAR(255)
created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  -- auto via trigger

-- Partial unique index: at most one default brand kit per institute
CREATE UNIQUE INDEX uq_brand_kit_default_per_institute
  ON brand_kit (institute_id) WHERE is_default = TRUE;

-- studio_avatar
id                   VARCHAR(64)  PK
institute_id         VARCHAR(255) FK → institutes(id)
name                 VARCHAR(120)
provider             VARCHAR(32)  DEFAULT 'custom'  -- V228: 'custom'|'argil'|'veed'
external_avatar_id   VARCHAR(120)                   -- V228: fal.ai enum (null when custom)
face_image_url       TEXT                           -- V228: NULL allowed for built-ins
preview_image_url    TEXT                           -- V228: thumbnail (null for built-ins in v1)
description          TEXT
voice_id             VARCHAR(120)
voice_provider       VARCHAR(32)                    -- google | sarvam | edge
voice_language       VARCHAR(32)
voice_gender         VARCHAR(16)
created_by           VARCHAR(255)
created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  -- trigger

CREATE INDEX idx_studio_avatar_provider ON studio_avatar (institute_id, provider);
```

The brand kit augments rather than replaces the legacy single-config (`institute.setting_json.VIDEO_STYLE + VIDEO_BRANDING`); the video pipeline falls back to the legacy `setting_json` path when no kit row exists.

---

## 3. API surface — frontend → backend cross-reference

URL constants live in [constants/urls.ts](vacademy_platform/frontend-admin-dashboard/src/constants/urls.ts) (lines 51–69).

### 3.1 Vimotion auth (auth_service)

| Frontend constant | URL | Frontend caller | Backend |
| --- | --- | --- | --- |
| `VIMOTION_REQUEST_SIGNUP_OTP` | `POST /auth-service/v1/vimotion/request-signup-otp` | `requestSignupOtp` ([api/signup.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/signup.ts)) — called from `ContactStep`, `OtpStep` (resend) | `VimotionAuthController.requestSignupOtp` |
| `VIMOTION_VERIFY_SIGNUP_OTP` | `POST /auth-service/v1/vimotion/verify-signup-otp` | `verifySignupOtp` — called from `OtpStep` | `VimotionAuthController.verifySignupOtp` |
| `VIMOTION_SIGNUP` | `POST /auth-service/v1/vimotion/signup` | `vimotionSignup` — called from `AccountTypeStep` (individual) and `StudioDetailsStep` (studio/agency) | `VimotionAuthController.signup` |
| `VIMOTION_LOGIN` | `POST /auth-service/v1/vimotion/login` | `vimotionLogin` — called from `LoginForm` | `VimotionAuthController.login` |

### 3.2 Vimotion brand kits (admin_core_service)

| Frontend constant | URL | Frontend caller | Backend |
| --- | --- | --- | --- |
| `VIMOTION_BRAND_KITS` | `GET .../brand-kits?instituteId=…` | `listBrandKits` ([api/brandKits.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/brandKits.ts)) — `BrandKitsTab`, `VimBrandKitSelect` | `VimotionBrandKitController.list` |
| `VIMOTION_BRAND_KIT_BY_ID(id)` | `GET .../brand-kits/{id}` | `getBrandKit` | `VimotionBrandKitController.get` |
| `VIMOTION_BRAND_KIT_DEFAULT` | `GET .../brand-kits/default` | `getDefaultBrandKit` — `OnboardingBanner` | `VimotionBrandKitController.getDefault` |
| `VIMOTION_BRAND_KITS` | `POST .../brand-kits` | `createBrandKit` — `BrandKitDrawer` (new) | `VimotionBrandKitController.create` |
| `VIMOTION_BRAND_KIT_BY_ID(id)` | `PUT .../brand-kits/{id}` | `updateBrandKit` — `BrandKitDrawer` (edit) | `VimotionBrandKitController.update` |
| `VIMOTION_BRAND_KIT_SET_DEFAULT(id)` | `POST .../brand-kits/{id}/set-default` | `setDefaultBrandKit` — `BrandKitsTab` card menu | `VimotionBrandKitController.setDefault` |
| `VIMOTION_BRAND_KIT_BY_ID(id)` | `DELETE .../brand-kits/{id}` | `deleteBrandKit` — `BrandKitsTab` card menu | `VimotionBrandKitController.delete` |
| `VIMOTION_BRAND_KIT_SCRAPE` | `POST <ai-service>/admin/vimotion/v1/brand-kits/scrape` (60 s timeout) | `scrapeBrandKitFromUrl` — `BrandKitDrawer` "Build from website" | ai_service (returns draft only — FE then calls POST `/brand-kits` to persist) |

### 3.3 Vimotion studio avatars (admin_core_service)

| Frontend constant | URL | Frontend caller | Backend |
| --- | --- | --- | --- |
| `VIMOTION_AVATARS` | `GET .../avatars?instituteId=…` | `listAvatars` ([api/avatars.ts](vacademy_platform/frontend-admin-dashboard/src/features/vimotion/api/avatars.ts)) — `AvatarsTab`, `VimSavedAvatarSelect` | `VimotionAvatarController.list` |
| `VIMOTION_AVATAR_BY_ID(id)` | `GET .../avatars/{id}` | `getAvatar` | `VimotionAvatarController.get` |
| `VIMOTION_AVATARS` | `POST .../avatars` | `createAvatar` — `AvatarDrawer` (new) | `VimotionAvatarController.create` |
| `VIMOTION_AVATAR_BY_ID(id)` | `PUT .../avatars/{id}` | `updateAvatar` — `AvatarDrawer` (edit) | `VimotionAvatarController.update` |
| `VIMOTION_AVATAR_BY_ID(id)` | `DELETE .../avatars/{id}` | `deleteAvatar` — `AvatarsTab` card menu | `VimotionAvatarController.delete` |

### 3.4 Shared services used by the vim shell (not vim-specific endpoints)

These are pre-existing endpoints in `video-api-studio`/auth/media that vim wraps:

| Use case | Endpoint | FE caller |
| --- | --- | --- |
| Recent grid | `GET <external>/external/video/v1/history?limit=20&offset=0` | `getRemoteHistory` (RecentTab) |
| Assets list/upload/delete | `…/external/video/v1/input-assets/*` | `listInputAssets`, `createInputAsset`, `fetchImageMetadata`, `fetchVideoContext`, `deleteInputAsset` (AssetsTab, AssetDetailPanel) |
| Save edits | `PATCH <external>/external/video/v1/videos/{id}` (timeline) | `useVideoEditorStore.saveChanges` |
| Render | `POST <external>/external/video/v1/videos/{id}/render` + `GET .../renders/{job_id}` | `requestVideoRender`, `getRenderStatus` (VideoEditorPage) |
| Sentence re-narrate | `…/external/video/v1/videos/{id}/sentences/{idx}/regenerate` | `sentence-api.ts` |
| Audio tracks | `…/external/video/v1/videos/{id}/audio-tracks` | `audio-track-api.ts` |
| API key auto-provision | `POST <admin>/admin-core-service/external/api-keys` | `generateApiKey` (useVimotionApiKey) |
| Studio name (header) | `GET .../institute/v1/institute-without-batches/{id}` | `useStudioName` |
| AI credits panel | `GET .../admin-core-service/ai-credits/...` | `useAiCreditsQuery` |
| File upload (S3) | `useFileUpload` hook + `getPublicUrl` | logo upload, face image, avatar uploads, asset upload |
| TTS voices | `…/external/video/v1/tts/voices` | `fetchTtsVoices` (AvatarDrawer) |
| Video templates | ai_service templates | `fetchVideoTemplates` (BrandKitDrawer) |

---

## 4. Lifecycle summary

1. **Signup** — wizard requests OTP → verifies (issues 15-min JWT) → final POST creates `institutes` row with `product='vimotion'`, upserts a `User` with ADMIN role for that institute, returns JWT pair. Cookies set; `/vim/dashboard`.
2. **First dashboard load** — `useVimotionApiKey` provisions an external API key. `OnboardingBanner` polls for a default brand kit; if none, prompts the user to create one (drawer pre-filled). Dashboard tour auto-starts on the Recent tab.
3. **Setup (one-time)** — user creates a default brand kit and at least one saved avatar.
4. **Create video** — user lands on the Create tab → `VideoConsoleWorkspace` (vimMode) shows the composer with `VimBrandKitSelect` + `VimSavedAvatarSelect`. Submitting kicks off generation; the new job shows up on Recent.
5. **Preview** — clicking a completed Recent card opens the production view (`?videoId=…`) inside the dashboard shell.
6. **Refine** — "Edit this scene" routes to `/vim/edit/:videoId?focusTime=…`. The editor loads timeline + audio + words; user trims shots, remakes scenes with AI, edits text/media, re-narrates sentences, adds music. Save → Render → Download MP4.
