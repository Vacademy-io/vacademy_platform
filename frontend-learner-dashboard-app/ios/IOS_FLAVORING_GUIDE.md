# iOS App Flavoring Setup Guide

This guide explains how to set up iOS app flavoring for the following apps:

| App Name | Bundle ID | Status |
|----------|-----------|--------|
| **the7cs** | `com.sevencs.learner` | New target needed |
| **SSDC HORIZON** | `io.ssdc.student.app` | New target needed |
| **Vacademy Learner** | `io.vacademy.student.app` | Already exists (App target) |

## Prerequisite Files Created

The following files have been created automatically:

1. **flavor.config.ts** - Updated with all flavor configurations
2. **ios/App/the7cs-Info.plist** - Info.plist for the7cs target
3. **ios/App/SSDC-HORIZON-Info.plist** - Info.plist for SSDC HORIZON target

## Manual Setup Steps in Xcode

Since Xcode project files are complex and best edited through Xcode itself, follow these steps:

### Step 1: Open the Xcode Project

```bash
cd ios/App
open App.xcworkspace
```

### Step 2: Create "the7cs" Target

1. In the **Project Navigator** (left sidebar), click on the **App** project (blue icon at the top)
2. Right-click on the existing **App** target → **Duplicate**
3. Rename the duplicated target to **the7cs**
4. In the target's **Build Settings**, update:
   - **Product Bundle Identifier**: `com.sevencs.learner`
   - **INFOPLIST_FILE**: `the7cs-Info.plist`
   - **MARKETING_VERSION**: `1.0.0`
   - **CURRENT_PROJECT_VERSION**: `1`
5. In **Build Settings**, set:
   - **ASSETCATALOG_COMPILER_APPICON_NAME**: `The7csIcon` (you'll create this)

### Step 3: Create "SSDC HORIZON" Target

1. Right-click on the existing **App** target → **Duplicate**
2. Rename the duplicated target to **SSDC HORIZON**
3. In the target's **Build Settings**, update:
   - **Product Bundle Identifier**: `io.ssdc.student.app`
   - **INFOPLIST_FILE**: `SSDC-HORIZON-Info.plist`
   - **MARKETING_VERSION**: `1.0.0`
   - **CURRENT_PROJECT_VERSION**: `1`
4. In **Build Settings**, set:
   - **ASSETCATALOG_COMPILER_APPICON_NAME**: `SSDCicon` (already exists)

### Step 4: Add App Icons

For each target, you need to add app icons to `App/Assets.xcassets`:

1. **the7cs**: Create `The7csIcon.appiconset` folder with appropriate icons
2. **SSDC HORIZON**: Already has `SSDCicon.appiconset` (verify it contains icons)
3. **Vacademy Learner** (App target): Uses `AppIcon.appiconset` (verify it contains icons)

### Step 5: Update Podfile for New Targets

Edit `ios/App/Podfile` to include the new targets:

```ruby
# Uncomment the next line to define a global platform for your project
platform :ios, '14.0'

def shared_pods
  # Add your pods here
  use_frameworks!
end

target 'App' do
  shared_pods
  capacitor_pods
end

target 'the7cs' do
  shared_pods
  capacitor_pods
end

target 'SSDC HORIZON' do
  shared_pods
  capacitor_pods
end

# If you already have Five Sep target, keep it
target 'Five Sep' do
  shared_pods
  capacitor_pods
end
```

Then run:

```bash
cd ios/App
pod install
```

### Step 6: Build and Test Each Target

Select each scheme from the Xcode toolbar and build:

1. **App** (Vacademy Learner) - Bundle ID: `io.vacademy.student.app`
2. **the7cs** - Bundle ID: `com.sevencs.learner`
3. **SSDC HORIZON** - Bundle ID: `io.ssdc.student.app`

## Flavor Configuration

The `flavor.config.ts` file maps bundle IDs to their domain/subdomain:

```typescript
// iOS bundle identifiers
"com.sevencs.learner": {        // the7cs
  appName: "the7cs",
  domain: "vacademy.io",
  subdomain: "7cs",
},
"io.ssdc.student.app": {        // SSDC HORIZON
  appName: "SSDC HORIZON",
  domain: "vacademy.io",
  subdomain: "ssdc",
},
"io.vacademy.student.app": {    // Vacademy Learner
  appName: "Vacademy Learner",
  domain: "vacademy.io",
  subdomain: "vacademy",
},
```

## How It Works

When the app runs on iOS:
1. Capacitor's `App.getInfo()` returns the bundle identifier
2. `platform-flavor.ts` looks up this bundle ID in `flavor.config.ts`
3. The appropriate domain and subdomain are returned
4. Your app uses these values for API calls and other configurations

## Troubleshooting

### "No matching flavor config found"
- Ensure the bundle ID in Xcode matches exactly with `flavor.config.ts`
- Bundle IDs are case-sensitive

### Pod installation issues
- Run `pod deintegrate && pod install` to reset CocoaPods
- Make sure all targets are defined in Podfile

### App icon not showing
- Verify the `ASSETCATALOG_COMPILER_APPICON_NAME` matches the icon set name
- Ensure the icon set has all required sizes

## Building for Distribution

To build each flavor for distribution:

```bash
# Build the7cs
xcodebuild -workspace App.xcworkspace -scheme "the7cs" -configuration Release archive

# Build SSDC HORIZON
xcodebuild -workspace App.xcworkspace -scheme "SSDC HORIZON" -configuration Release archive

# Build Vacademy Learner (App)
xcodebuild -workspace App.xcworkspace -scheme "App" -configuration Release archive
```
