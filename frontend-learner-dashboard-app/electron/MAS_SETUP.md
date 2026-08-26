# Shiksha Nation — Mac App Store submission

Ships as the **macOS platform of the existing app record** (app id 6785750270,
team 7XKD5M7288 / Saurabh Kumar). The Mac build therefore carries the SAME
bundle id as the iOS app — `io.shikshanationapp.com`. A different id would
create a separate listing instead of joining that record.

Version is pinned to **1.0** via `extraMetadata` to match the version record in
App Store Connect; `CFBundleVersion` (`buildVersion`) must be bumped on every
re-upload. electron/package.json (1.0.12) is untouched, so Windows/DMG builds
are unaffected.

This is separate from the DMG. `electron-builder.shikshanation.json` builds the
direct-download DMG (GitHub release → Drive link) and is unchanged. MAS uses
`electron-builder.shikshanation-mas.json` and outputs a `.pkg` in `dist-mas/`.

## One-time Apple setup (needs the Apple ID + 2FA — cannot be done headless)

On **team 7XKD5M7288**:

1. developer.apple.com → Identifiers → open the EXISTING `io.shikshanationapp.com` App ID and enable **macOS** for it (do NOT create a new id)
2. App Store Connect → DONE: macOS platform added to the existing "Shiksha Nation" record (app id 6785750270), showing *macOS App 1.0 — Prepare for Submission*
3. Certificates → create both:
   - **Apple Distribution** (or "3rd Party Mac Developer Application") — signs the `.app`
   - **Mac Installer Distribution** (or "3rd Party Mac Developer Installer") — signs the `.pkg`
4. Profiles → create a **Mac App Store** provisioning profile for `io.shikshanationapp.com`,
   download it, and save it here as `embedded.provisionprofile` (git-ignored; per-account)

Current machine state: only `Apple Development: Saurabh Kumar` (7XKD5M7288) is
installed — a *development* cert, which cannot sign a store build. The only
*distribution* cert present belongs to a DIFFERENT team (35NLZB49QN, Shreyash
Jain), which must NOT be used here.

## ⚠ Pin the signing identity

electron-builder auto-discovers a signing identity. With a 35NLZB49QN
distribution cert in the keychain it can pick that one, producing a signature
whose team does not match the entitlements (stamped 7XKD5M7288) — the upload
then fails with a confusing profile/identity mismatch. Always pin it:

```bash
export CSC_NAME="Apple Distribution: Saurabh Kumar (7XKD5M7288)"   # exact name from: security find-identity -v -p codesigning
cd electron && npm run build:mas:shikshanation
```

## Compliance — read before submitting

Guideline 3.1.1 applies to the Mac App Store too, so the MAS build must hide
commerce exactly like iOS does. It cannot be a runtime platform check: the DMG
and the MAS `.pkg` are the same app on the same OS, and only the store build is
bound by the rule. So it is a BUILD-TIME flag.

```bash
cd frontend-learner-dashboard-app
VITE_MAC_APP_STORE=true pnpm build      # reader mode ON for this bundle only
```

The flag is plumbed through Vite `define` (`__MAC_APP_STORE__` in
vite.config.ts), NOT through `import.meta.env`. That is deliberate: this project
has no `.env` files and **Vite does not copy `process.env` into
`import.meta.env`**, so an env-var-only version compiles silently to `false` and
ships a non-compliant package that looks correct. Do not "simplify" it back.

### Verify before every upload

The whole point is a flag that fails silently, so check it:

```bash
python3 - <<'EOF'
import re,glob
for p in glob.glob('dist/assets/*.js'):
    s=open(p,encoding='utf-8',errors='replace').read()
    m=re.search(r'beforeLoad:async\(\)=>\{if\((\w+)\(\)\)throw', s)
    if not m: continue
    fn=m.group(1)
    d=re.search(re.escape(fn)+r'\s*=\s*\(\)=>([^,;]{0,80})', s)
    print('reader gate:', fn, '=', d.group(1) if d else '?')
EOF
```

- reader mode **ON**  → the gate is always-true (e.g. `()=>!0`, or `...||!0`)
- reader mode **OFF** → `()=>X.getPlatform()==="ios"`  ← WRONG for a MAS upload

## Upload

```bash
xcrun altool --upload-app -f dist-mas/*.pkg -t macos \
  --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
```
(or drag the `.pkg` into Transporter.app)
