# Stops containers from docker compose WITHOUT deleting volumes (keeps your data)
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "Stopping DB (docker compose down) in: $PSScriptRoot"
docker compose down

Write-Host "Done."