<#
Enable system-wide PowerShell execution policy and install pnpm@9.15.5.
Run this script from an elevated PowerShell (Run as Administrator).

Usage:
  Open PowerShell as Administrator and run:
    .\scripts\enable-pnpm.ps1

This script will:
 - ensure it runs elevated
 - set ExecutionPolicy to RemoteSigned for LocalMachine
 - attempt `corepack prepare pnpm@9.15.5 --activate`
 - if Corepack fails, fall back to `npm install -g pnpm@9.15.5`
#>

function Assert-Admin {
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Write-Error 'This script must be run as Administrator. Right-click PowerShell and choose "Run as administrator".'
    exit 1
  }
}

function Try-Command {
  param($ScriptBlock)
  try {
    & $ScriptBlock
    return $true
  } catch {
    Write-Host 'Command failed:' $_ -ForegroundColor Yellow
    return $false
  }
}

Assert-Admin

Write-Host 'Setting system execution policy to RemoteSigned (LocalMachine)...' -ForegroundColor Cyan
Try-Command { Set-ExecutionPolicy -Scope LocalMachine -ExecutionPolicy RemoteSigned -Force }

Write-Host 'Attempting to activate pnpm via Corepack...' -ForegroundColor Cyan
$corepackOk = $false
try {
  corepack prepare pnpm@9.15.5 --activate 2>&1 | Write-Host
  $corepackOk = $LASTEXITCODE -eq 0
} catch {
  Write-Host 'Corepack attempt failed:' $_ -ForegroundColor Yellow
  $corepackOk = $false
}

if ($corepackOk) {
  Write-Host 'pnpm activated via Corepack.' -ForegroundColor Green
  exit 0
}

Write-Host 'Corepack failed — falling back to npm global install of pnpm@9.15.5' -ForegroundColor Yellow

# Try installing via npm (cmd fallback)
try {
  $cmd = 'npm install -g pnpm@9.15.5'
  Write-Host 'Running:' $cmd -ForegroundColor Cyan
  cmd /c $cmd
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'pnpm installed globally.' -ForegroundColor Green
    exit 0
  } else {
    Write-Host 'npm global install returned exit code:' $LASTEXITCODE -ForegroundColor Yellow
  }
} catch {
  Write-Host 'npm install fallback failed:' $_ -ForegroundColor Red
}

$manual = @'
Manual steps if the above failed:
 - ensure network/proxy allows access to registry.npmjs.org
 - run 'Invoke-WebRequest https://registry.npmjs.org/pnpm/-/pnpm-9.15.5.tgz' to test connectivity
 - or download pnpm-9.15.5.tgz on another machine and run:
   npm install -g C:\path\to\pnpm-9.15.5.tgz
'@

Write-Host $manual -ForegroundColor Yellow

exit 1
