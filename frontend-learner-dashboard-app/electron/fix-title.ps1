$file = "src\setup.ts"
$content = Get-Content $file -Raw -Encoding UTF8
$content = $content -replace 'title: `\$\{app\.getName\(\)\} v\$\{appVersion\}`[^\r\n]*', 'title: `SSDC Horizon v${appVersion}`,'
Set-Content $file -Value $content -NoNewline -Encoding UTF8
Write-Host "Fixed window title!" -ForegroundColor Green

