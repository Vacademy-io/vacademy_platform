# Google Meet Integration — Google Cloud setup (what you do, to unblock the build)

> Goal: produce the **one shared OAuth app's credentials** + identify the **test Workspace organizer account** so I can build and test the connect → create-meeting → join → recording flow locally. Follow these once; send me the four values at the bottom.
>
> Companion: [google-meet-integration-plan.md](./google-meet-integration-plan.md). Locked build decisions: recording **in** v1 (auto-record + Events-API detect), recordings **admin-only** in v1, **one shared organizer account per institute**, build+test **locally with a tunnel**.

---

## Step 1 — Create/choose a Google Cloud project
- console.cloud.google.com → create a project, e.g. **`vacademy-google-meet`** (or reuse an existing Vacademy-owned project). This project belongs to **us**, not to any institute.

## Step 2 — Enable APIs
APIs & Services → Library → enable:
- **Google Meet API**
- **Google Workspace Events API**
- **Cloud Pub/Sub API**
- *(Phase 2 only, skip for now: Google Calendar API, Google Drive API)*

## Step 3 — OAuth consent screen
APIs & Services → OAuth consent screen:
- **User type: External.**
- App name (e.g. "Vacademy"), user support email, developer contact email. Logo optional for testing.
- **Scopes** → add exactly these two:
  - `https://www.googleapis.com/auth/meetings.space.created`
  - `https://www.googleapis.com/auth/meetings.space.readonly`
- **Privacy policy URL + Terms of Service URL** on a domain you own (needed for production verification; for Testing mode a real Vacademy URL is fine).
- **Test users** → add your Google account, the organizer test account (Step 5), and **send me a test Google email** to add too.
- **Leave the app in "Testing"** for now. (Testing caps: ≤100 users, refresh tokens expire after 7 days — fine for dev. We submit for verification in parallel before real institutes; that's the long pole, ~days→weeks.)

## Step 4 — Create the OAuth Client ID
APIs & Services → Credentials → Create credentials → **OAuth client ID**:
- **Application type: Web application.**
- Name: "Vacademy Meet backend".
- **Authorized redirect URIs** → add:
  - `http://localhost:8072/admin-core-service/live-sessions/provider/google/oauth/callback`  *(local dev — works for the connect/create/join testing)*
  - *(I'll send you one more HTTPS redirect URI — the ngrok tunnel — when I start, for the recording/Events test. Adding it later is one click.)*
- (No "Authorized JavaScript origins" needed — this is a server-side flow.)
- Create → **copy the Client ID and Client secret.**

## Step 5 — The test Workspace organizer account
- Pick a **paid, recording-capable** Workspace account to act as the shared organizer: **Business Standard/Plus, Enterprise *, or Education Plus / Teaching & Learning Upgrade**. ❌ Not Business Starter, Education Fundamentals/Standard, or free Gmail.
- As the **Workspace admin**, confirm: Meet **recording is allowed** (Admin console → Apps → Google Workspace → Google Meet → Meet video settings → Recording ON), and if your domain restricts third-party apps, mark our OAuth **client ID as Trusted** (Security → API controls → App access control).
- This account is the "designated organizer" — it owns the meetings + recordings during testing.
- A **second account** (any account in the same Workspace) is useful to play the teacher-host; I'll test a learner as an anonymous guest.

## Step 6 — Cloud Pub/Sub (needed only for the recording/attendance test — can wait)
When we reach the recording phase I'll give you the exact topic name + push endpoint + the IAM grant for the Workspace Events service account. You can pre-create a topic `meet-events` now if you like, but it's not blocking the start.

---

## Send me these four things to start
1. **OAuth Client ID**
2. **OAuth Client secret**  *(share via whatever secret channel you prefer)*
3. **Organizer test account email** + its **Workspace edition** (so I can confirm it can record)
4. **A test Google email** you've added as an OAuth test user (so I can drive a learner/guest join)

The moment I have #1–#3, I start building Phase 1 (connect) → Phase 2 (create meeting) → Phase 3 (join). #4 and the tunnel/Pub/Sub come in for Phase 4 (recording + attendance).
