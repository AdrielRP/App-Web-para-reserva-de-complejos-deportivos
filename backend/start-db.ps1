# Starts the PostgreSQL container using docker compose from this folder
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "Starting DB (docker compose up -d) in: $PSScriptRoot"
docker compose up -d

Write-Host ""
Write-Host "DB containers:"
docker ps --filter "name=pichangaya-db"

Write-Host ""
Write-Host "Done."