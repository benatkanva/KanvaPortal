# PowerShell script to run dev server with logging to file
Write-Host "Starting dev server with logging..." -ForegroundColor Green
Write-Host "Logs will be saved to: commission-calc-logs.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""

# Run npm dev and save output to file
npm run dev 2>&1 | Tee-Object -FilePath "commission-calc-logs.txt"
