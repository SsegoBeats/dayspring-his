param(
  [string]$OutDir = "secrets",
  [string]$CommonName = "dayspring.local"
)

function To-Pem([byte[]] $bytes, [string] $header) {
  $b64 = [System.Convert]::ToBase64String($bytes)
  $lines = $b64 -split "(?<=.{1,64})" | Where-Object { $_ -ne "" }
  $content = ($lines -join "`n")
  return "-----BEGIN $header-----`n$content`n-----END $header-----`n"
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$key = Join-Path $OutDir "qz-private.key"
$crt = Join-Path $OutDir "qz-public.crt"

$hasOpenSSL = (Get-Command openssl -ErrorAction SilentlyContinue) -ne $null
if ($hasOpenSSL) {
  Write-Host "OpenSSL found — generating keys via OpenSSL" -ForegroundColor Cyan
  & openssl genrsa -out $key 2048
  if ($LASTEXITCODE -ne 0) { Write-Host "Failed to generate private key" -ForegroundColor Red; exit 1 }
  & openssl req -new -x509 -key $key -out $crt -days 3650 -subj "/C=UG/ST=Central/L=Kampala/O=Dayspring/OU=IT/CN=$CommonName"
  if ($LASTEXITCODE -ne 0) { Write-Host "Failed to generate certificate" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "OpenSSL not found — using .NET fallback" -ForegroundColor Yellow
  Add-Type -AssemblyName System.Security
  $rsa = [System.Security.Cryptography.RSA]::Create(2048)
  $dn = "CN=$CommonName, O=Dayspring, OU=IT, L=Kampala, S=Central, C=UG"
  $hash = [System.Security.Cryptography.HashAlgorithmName]::SHA256
  $pad = [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  $req = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest($dn, $rsa, $hash, $pad)
  # 10-year cert, backdate 1 day
  $notBefore = [DateTimeOffset]::Now.AddDays(-1)
  $notAfter  = [DateTimeOffset]::Now.AddYears(10)
  $cert = $req.CreateSelfSigned($notBefore, $notAfter)
  # Export PKCS#1 private key (DER) and DER cert (for environments without ExportPkcs8PrivateKey)
  function Encode-Integer([byte[]]$i) {
    # Remove leading zeros
    $bytes = $i
    while ($bytes.Length -gt 1 -and $bytes[0] -eq 0) { $bytes = $bytes[1..($bytes.Length-1)] }
    # If high bit set, prepend 0x00
    if (($bytes[0] -band 0x80) -ne 0) { $bytes = ,0 + $bytes }
    $len = $bytes.Length
    if ($len -lt 128) { $lenBytes = [byte[]]@([byte]$len) }
    else {
      $tmp = @()
      $v = $len
      while ($v -gt 0) { $tmp = ,([byte]($v -band 0xFF)) + $tmp; $v = $v -shr 8 }
      $lenBytes = ,([byte](0x80 -bor $tmp.Length)) + $tmp
    }
    return ,0x02 + $lenBytes + $bytes
  }
  function Encode-Sequence([byte[]]$content) {
    $len = $content.Length
    if ($len -lt 128) { $lenBytes = [byte[]]@([byte]$len) }
    else {
      $tmp = @()
      $v = $len
      while ($v -gt 0) { $tmp = ,([byte]($v -band 0xFF)) + $tmp; $v = $v -shr 8 }
      $lenBytes = ,([byte](0x80 -bor $tmp.Length)) + $tmp
    }
    return ,0x30 + $lenBytes + $content
  }
  $p = $rsa.ExportParameters($true)
  # Build PKCS#1 structure: version(0), n, e, d, p, q, dp, dq, qi
  [byte[]]$ver = 0
  [byte[]]$content = @()
  $content += (Encode-Integer $ver)
  $content += (Encode-Integer $p.Modulus)
  $content += (Encode-Integer $p.Exponent)
  $content += (Encode-Integer $p.D)
  $content += (Encode-Integer $p.P)
  $content += (Encode-Integer $p.Q)
  $content += (Encode-Integer $p.DP)
  $content += (Encode-Integer $p.DQ)
  $content += (Encode-Integer $p.InverseQ)
  $privBytes = Encode-Sequence $content
  $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  Set-Content -Path $key -Value (To-Pem $privBytes "RSA PRIVATE KEY") -NoNewline
  Set-Content -Path $crt -Value (To-Pem $certBytes "CERTIFICATE") -NoNewline
}

Write-Host "Done." -ForegroundColor Green
Write-Host "Created:" $key
Write-Host "Created:" $crt
Write-Host "Update .env.local or ensure it contains:" -ForegroundColor Cyan
Write-Host "QZ_PRIVATE_KEY_FILE=$key"
Write-Host "QZ_PUBLIC_CERT_FILE=$crt"
