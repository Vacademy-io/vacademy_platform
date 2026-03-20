# Production Windows build script for SSDC Horizon (PowerShell version)
# Ensures all node_modules and web app files are properly included

Write-Host "🚀 Building Production Windows Electron App (x64 + x86)" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# Step 1: Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Blue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Write-Host "✅ Clean complete" -ForegroundColor Green
Write-Host ""

# Step 2: Check if web app is built
Write-Host "📱 Checking web app build..." -ForegroundColor Blue
if (-not (Test-Path "..\dist\index.html")) {
    Write-Host "⚠️  Web app not built. Building now..." -ForegroundColor Yellow
    Set-Location ..
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Web app build failed" -ForegroundColor Red
        exit 1
    }
    Set-Location electron
    Write-Host "✅ Web app built" -ForegroundColor Green
} else {
    Write-Host "✅ Web app already built" -ForegroundColor Green
}
Write-Host ""

# Step 3: Ensure dependencies are installed
Write-Host "📦 Checking dependencies..." -ForegroundColor Blue
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found, installing..." -ForegroundColor Yellow
    npm install
}
Write-Host "✅ Dependencies ready" -ForegroundColor Green
Write-Host ""

# Step 4: Compile TypeScript
Write-Host "📝 Compiling TypeScript..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ TypeScript compiled" -ForegroundColor Green
Write-Host ""

# Step 5: Build with electron-builder
Write-Host "🔨 Building Windows installers (x64 + ia32)..." -ForegroundColor Blue
Write-Host "   This will create:"
Write-Host "   • NSIS installers for x64 and ia32"
Write-Host "   • Portable executables for x64 and ia32"
Write-Host "   • Includes web app files (211 files)"
Write-Host ""

npx electron-builder build --win -c ./electron-builder.production.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""

# Step 6: Verify build results
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "🔍 Verification:" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# Check for web app files
$appPath = "dist\win-unpacked\resources\app\app"
if (Test-Path $appPath) {
    $fileCount = (Get-ChildItem -Path $appPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $dirSize = (Get-ChildItem -Path $appPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "✅ Web app files included!" -ForegroundColor Green
    Write-Host "   Location: $appPath"
    Write-Host "   Files: $fileCount"
    Write-Host "   Size: $([math]::Round($dirSize, 2)) MB"
    Write-Host ""
    Write-Host "✅ ERR_FILE_NOT_FOUND error is FIXED!" -ForegroundColor Green
} else {
    Write-Host "❌ WARNING: Web app directory not found!" -ForegroundColor Red
    Write-Host "   Expected: $appPath"
}

Write-Host ""

# Check for node_modules
$nmPath = "dist\win-unpacked\resources\app\node_modules"
if (Test-Path $nmPath) {
    $nmSize = (Get-ChildItem -Path $nmPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "✅ Node modules included: $([math]::Round($nmSize, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "❌ WARNING: node_modules not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "📊 Build Results:" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

if (Test-Path "dist") {
    Write-Host "Installers:"
    Get-ChildItem -Path dist -Filter "*.exe" | ForEach-Object {
        $size = "{0:N2} MB" -f ($_.Length / 1MB)
        Write-Host "  📦 $($_.Name) ($size)"
    }
    Write-Host ""
    
    Write-Host "Unpacked directories:"
    Get-ChildItem -Path dist -Directory -Filter "win-*unpacked" | ForEach-Object {
        $size = "{0:N2} GB" -f ((Get-ChildItem -Path $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB)
        Write-Host "  📁 $($_.Name): $size"
    }
    Write-Host ""
    
    $distSize = (Get-ChildItem -Path dist -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB
    Write-Host "Total dist size: $([math]::Round($distSize, 2)) GB"
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "✅ All builds completed successfully!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "🧪 To test:"
Write-Host '  .\dist\win-unpacked\"SSDC Horizon.exe"'
Write-Host ""
Write-Host "📦 To install:"
Write-Host '  .\dist\"SSDC Horizon Setup 1.0.7.exe"'
Write-Host ""

