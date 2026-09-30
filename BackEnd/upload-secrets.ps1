# Stop if any command fails
$ErrorActionPreference = "Stop"

$vault = "kv-collegead-prod"

# Load .env
$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
    throw ".env file not found: $envFile"
}

$envValues = @{}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()

    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        # Remove surrounding quotes
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $envValues[$key] = $value
    }
}

# Secrets to upload
$secretNames = @(
    "JWT_SECRET",
    "DB_PASSWORD",
    "DB_USER",
    "DB_NAME",
    "DB_SERVER",
    "DB_PORT",

    "PAYU_MERCHANT_KEY",
    "PAYU_MERCHANT_SALT",

    "GEMINI_API_KEY",

    "WHATSAPP_API_TOKEN",

    "WHATSAPP_TPL_OTP",
    "WHATSAPP_TPL_CORRECTION_REQUESTED",
    "WHATSAPP_TPL_APPLICATION_ACCEPTED",
    "WHATSAPP_TPL_APPLICATION_REJECTED",
    "WHATSAPP_TPL_ADMISSION_CONFIRMED",
    "WHATSAPP_TPL_FEES_PAID",
    "WHATSAPP_TPL_ROLL_ASSIGNED"
)

foreach ($name in $secretNames) {

    if (-not $envValues.ContainsKey($name)) {
        Write-Host "SKIP: $name not found in .env"
        continue
    }

    $value = $envValues[$name]

    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "SKIP: $name is empty"
        continue
    }

    # Azure Key Vault secret names cannot contain underscores
    $keyVaultName = $name.Replace("_", "-")

    Write-Host "Uploading: $keyVaultName"

    az keyvault secret set `
        --vault-name $vault `
        --name $keyVaultName `
        --value $value `
        --output none

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload $name"
    }
}

Write-Host ""
Write-Host "All selected secrets uploaded successfully." -ForegroundColor Green