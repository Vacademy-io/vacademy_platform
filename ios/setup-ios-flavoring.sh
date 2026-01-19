#!/bin/bash

# iOS Flavoring Setup Script
# This script helps set up the iOS flavoring by automating some tasks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$SCRIPT_DIR"
APP_DIR="$IOS_DIR/App"

echo "🍎 iOS Flavoring Setup Script"
echo "=============================="
echo ""

# Check if we're in the right directory
if [ ! -f "$APP_DIR/Podfile" ]; then
    echo "❌ Error: Cannot find Podfile. Make sure you're running this from the ios directory."
    exit 1
fi

echo "📁 Working directory: $APP_DIR"
echo ""

# Function to check if Xcode is installed
check_xcode() {
    if ! command -v xcodebuild &> /dev/null; then
        echo "❌ Error: Xcode command line tools not found."
        echo "   Install with: xcode-select --install"
        exit 1
    fi
    echo "✅ Xcode command line tools found"
}

# Function to check if CocoaPods is installed
check_cocoapods() {
    if ! command -v pod &> /dev/null; then
        echo "❌ Error: CocoaPods not found."
        echo "   Install with: sudo gem install cocoapods"
        exit 1
    fi
    echo "✅ CocoaPods found"
}

# Check requirements
check_xcode
check_cocoapods
echo ""

# Display the targets that need to be created
echo "📋 iOS App Flavors to Configure:"
echo "=================================================="
echo "| Target Name      | Bundle ID               | Status     |"
echo "=================================================="
echo "| App              | io.vacademy.student.app | Existing   |"
echo "| the7cs           | com.sevencs.learner     | NEW        |"
echo "| SSDC HORIZON     | io.ssdc.student.app     | NEW        |"
echo "| Five Sep         | io.fivesep.student.app  | Existing   |"
echo "=================================================="
echo ""

# Check for Info.plist files
echo "📄 Checking Info.plist files..."
if [ -f "$APP_DIR/the7cs-Info.plist" ]; then
    echo "   ✅ the7cs-Info.plist found"
else
    echo "   ❌ the7cs-Info.plist missing"
fi

if [ -f "$APP_DIR/SSDC-HORIZON-Info.plist" ]; then
    echo "   ✅ SSDC-HORIZON-Info.plist found"
else
    echo "   ❌ SSDC-HORIZON-Info.plist missing"
fi
echo ""

# Check for icon sets
echo "🎨 Checking app icon sets..."
if [ -d "$APP_DIR/App/Assets.xcassets/AppIcon.appiconset" ]; then
    echo "   ✅ AppIcon.appiconset found (Vacademy Learner)"
else
    echo "   ❌ AppIcon.appiconset missing"
fi

if [ -d "$APP_DIR/App/Assets.xcassets/The7csIcon.appiconset" ]; then
    echo "   ✅ The7csIcon.appiconset found (the7cs)"
else
    echo "   ❌ The7csIcon.appiconset missing"
fi

if [ -d "$APP_DIR/App/Assets.xcassets/SSDCicon.appiconset" ]; then
    echo "   ✅ SSDCicon.appiconset found (SSDC HORIZON)"
else
    echo "   ❌ SSDCicon.appiconset missing"
fi
echo ""

# Instructions for manual steps
echo "📝 MANUAL STEPS REQUIRED IN XCODE:"
echo "=================================="
echo ""
echo "1. Open the Xcode workspace:"
echo "   open $APP_DIR/App.xcworkspace"
echo ""
echo "2. Create 'the7cs' target:"
echo "   - Right-click 'App' target → Duplicate"
echo "   - Rename to 'the7cs'"
echo "   - Set Bundle Identifier: com.sevencs.learner"
echo "   - Set INFOPLIST_FILE: the7cs-Info.plist"
echo "   - Set ASSETCATALOG_COMPILER_APPICON_NAME: The7csIcon"
echo ""
echo "3. Create 'SSDC HORIZON' target:"
echo "   - Right-click 'App' target → Duplicate"
echo "   - Rename to 'SSDC HORIZON'"
echo "   - Set Bundle Identifier: io.ssdc.student.app"
echo "   - Set INFOPLIST_FILE: SSDC-HORIZON-Info.plist"
echo "   - Set ASSETCATALOG_COMPILER_APPICON_NAME: SSDCicon"
echo ""
echo "4. After creating targets, run pod install:"
echo "   cd $APP_DIR && pod install"
echo ""

# Ask if user wants to run pod install
read -p "Would you like to run 'pod install' now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Running pod install..."
    cd "$APP_DIR"
    pod install
    echo "✅ Pod install completed!"
fi

echo ""
echo "🎉 Setup check complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode: open $APP_DIR/App.xcworkspace"
echo "2. Create the new targets as described above"
echo "3. Add app icons (1024x1024 PNG) to each icon set"
echo "4. Build and test each target"
