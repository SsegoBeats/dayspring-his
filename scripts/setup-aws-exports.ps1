param(
  [string]$Region = "eu-central-1",
  [string]$Bucket = "",
  [string]$IamUser = "his-exports-user",
  [string]$EnvPath = ""
)

$ErrorActionPreference = "Stop"

# Ensure AWS CLI is available (supports absolute path fallback)
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  $awsExe = "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe"
  if (Test-Path -LiteralPath $awsExe) {
    Set-Alias -Name aws -Value $awsExe -Scope Script
  } else {
    throw "Required command 'aws' not found. Please install AWS CLI (winget install -e --id Amazon.AWSCLI) and re-run."
  }
}

if (-not $Bucket -or $Bucket.Trim() -eq "") {
  $Bucket = "dayspring-his-exports-prod-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
}

if (-not $EnvPath -or $EnvPath.Trim() -eq "") {
  $repoRoot = (Split-Path $PSScriptRoot -Parent)
  $EnvPath = Join-Path $repoRoot ".env"
}

Write-Host "[1/5] Creating KMS key..." -ForegroundColor Cyan
$KEY_ARN = aws kms create-key --description "Dayspring HIS Exports" --query "KeyMetadata.Arn" --output text --region $Region
aws kms create-alias --alias-name alias/his-exports --target-key-id $KEY_ARN --region $Region | Out-Null

Write-Host "[2/5] Creating S3 bucket '$Bucket' in $Region..." -ForegroundColor Cyan
if ($Region -eq "us-east-1") {
  aws s3api create-bucket --bucket $Bucket --region $Region | Out-Null
} else {
  aws s3api create-bucket --bucket $Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
}

Write-Host "Configuring default SSE-KMS and lifecycle (7 days)..."
$enc = @{
  Rules = @(@{
    ApplyServerSideEncryptionByDefault = @{ SSEAlgorithm = "aws:kms"; KMSMasterKeyID = $KEY_ARN }
    BucketKeyEnabled = $true
  })
} | ConvertTo-Json -Depth 5
aws s3api put-bucket-encryption --bucket $Bucket --region $Region --server-side-encryption-configuration $enc | Out-Null

$lifecycle = @{
  Rules = @(@{
    ID = "expire-exports"; Status = "Enabled"; Filter = @{ Prefix = "exports/" }; Expiration = @{ Days = 7 }
  })
} | ConvertTo-Json -Depth 5
aws s3api put-bucket-lifecycle-configuration --bucket $Bucket --region $Region --lifecycle-configuration $lifecycle | Out-Null

Write-Host "[3/5] Creating IAM user '$IamUser'..." -ForegroundColor Cyan
try { aws iam create-user --user-name $IamUser | Out-Null } catch { Write-Host "User may already exist; continuing." -ForegroundColor Yellow }

$policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::$Bucket" },
    { "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject"], "Resource": "arn:aws:s3:::$Bucket/*" },
    { "Effect": "Allow", "Action": ["kms:Encrypt","kms:Decrypt","kms:GenerateDataKey","kms:DescribeKey"], "Resource": "$KEY_ARN" }
  ]
}
"@
$policyPath = Join-Path $PSScriptRoot "his-exports-policy.json"
$policy | Set-Content -Encoding utf8 $policyPath
aws iam put-user-policy --user-name $IamUser --policy-name his-exports-inline --policy-document file://$policyPath | Out-Null

Write-Host "[4/5] Creating access keys..." -ForegroundColor Cyan
$CREDS = aws iam create-access-key --user-name $IamUser --query "AccessKey.[AccessKeyId,SecretAccessKey]" --output text
$ACCESS_KEY = ($CREDS -split "`t")[0]
$SECRET_KEY = ($CREDS -split "`t")[1]

Write-Host "[5/5] Updating .env at $EnvPath ..." -ForegroundColor Cyan

Update-TypeData -TypeName System.Array -MemberName FindIndex -MemberType ScriptMethod -Value {
  param([scriptblock]$predicate)
  for ($i=0; $i -lt $this.Length; $i++) { if (& $predicate $this[$i]) { return $i } }
  return -1
} -Force

function Set-Or-Add-Env($Path, $Key, $Value) {
  $lines = @()
  if (Test-Path -LiteralPath $Path) { $lines = Get-Content -LiteralPath $Path } else { $lines = @() }
  $regex = "^\s*$Key\s*="
  $idx = $lines.FindIndex({ $_ -match $regex })
  if ($idx -ge 0) { $lines[$idx] = "$Key=$Value" } else { $lines += "$Key=$Value" }
  Set-Content -LiteralPath $Path -Value $lines -Encoding UTF8
}

Set-Or-Add-Env $EnvPath "STORAGE_BUCKET"                $Bucket
Set-Or-Add-Env $EnvPath "STORAGE_REGION"                $Region
Set-Or-Add-Env $EnvPath "STORAGE_ACCESS_KEY_ID"         $ACCESS_KEY
Set-Or-Add-Env $EnvPath "STORAGE_SECRET_ACCESS_KEY"     $SECRET_KEY
Set-Or-Add-Env $EnvPath "STORAGE_SSE"                   "aws:kms"
Set-Or-Add-Env $EnvPath "STORAGE_KMS_KEY_ID"            "alias/his-exports"
Set-Or-Add-Env $EnvPath "EXPORT_SIGNED_URL_TTL_SEC"     "900"
Set-Or-Add-Env $EnvPath "STORAGE_ENDPOINT"              ""

Write-Host "\nSuccess!" -ForegroundColor Green
Write-Host "Bucket:       $Bucket"
Write-Host "KMS Key ARN:  $KEY_ARN"
Write-Host "AccessKeyId:  $ACCESS_KEY"
Write-Host "SecretKey:    $SECRET_KEY"
Write-Host "Updated .env: $EnvPath"


