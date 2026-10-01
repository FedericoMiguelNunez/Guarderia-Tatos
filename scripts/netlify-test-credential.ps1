param([ValidateSet('Save', 'Audit', 'Test', 'SelfTest')][string]$Action = 'Save')
$ErrorActionPreference = 'Stop'
function ConvertTo-CredentialPlaintext([Security.SecureString]$Secret) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Assert-CredentialTransport([string]$Value) {
    # This checks HTTP transport only, not Netlify prefix, length or authenticity.
    if ([string]::IsNullOrEmpty($Value)) { throw 'EMPTY_CREDENTIAL' }
    if ($Value -match '[^\x21-\x7e]') {
        throw 'INVALID_CREDENTIAL_INPUT: contiene espacios, controles o caracteres fuera de ASCII. No se guardo ni se envio.'
    }
}
function New-CredentialTextBox {
    Add-Type -AssemblyName System.Windows.Forms
    $inputBox = New-Object System.Windows.Forms.TextBox
    $inputBox.UseSystemPasswordChar = $true
    $inputBox.MaxLength = 0
    return $inputBox
}
function Read-CredentialInput {
    # Use a masked Windows control to avoid terminal paste/control sequences.
    $dialog = New-Object System.Windows.Forms.Form
    $dialog.Text = 'PAT temporal de Netlify - solo pruebas'
    $dialog.Width = 490
    $dialog.Height = 150
    $dialog.StartPosition = 'CenterScreen'
    $dialog.FormBorderStyle = 'FixedDialog'
    $inputBox = New-CredentialTextBox
    $inputBox.SetBounds(15, 15, 440, 25)
    $button = New-Object System.Windows.Forms.Button
    $button.Text = 'Guardar cifrado'
    $button.SetBounds(300, 55, 155, 30)
    $button.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $dialog.Controls.Add($inputBox)
    $dialog.Controls.Add($button)
    $dialog.AcceptButton = $button
    try {
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw 'CREDENTIAL_INPUT_CANCELLED' }
        Assert-CredentialTransport $inputBox.Text
        return ConvertTo-SecureString -String $inputBox.Text -AsPlainText -Force
    } finally {
        $inputBox.Clear()
        $dialog.Dispose()
    }
}
function Write-CredentialFile([Security.SecureString]$Secret, [string]$Target) {
    $value = ConvertTo-CredentialPlaintext $Secret
    try { Assert-CredentialTransport $value }
    finally { $value = $null }
    ConvertFrom-SecureString $Secret | Set-Content -LiteralPath $Target -Encoding ASCII
    $verified = Read-CredentialFile $Target
    try {
        if ((ConvertTo-CredentialPlaintext $verified) -cne (ConvertTo-CredentialPlaintext $Secret)) { throw 'DPAPI_ROUNDTRIP_FAILED' }
    } finally { $verified.Dispose() }
}
function Read-CredentialFile([string]$Target) {
    return (Get-Content -LiteralPath $Target -Raw).Trim() | ConvertTo-SecureString
}
if ($Action -eq 'SelfTest') {
    # Never read the actual credential file or contact a remote service.
    $syntheticPath = Join-Path ([IO.Path]::GetTempPath()) ('tatos-dpapi-synthetic-' + [guid]::NewGuid() + '.txt')
    $inputBox = New-CredentialTextBox
    try {
        if (-not $inputBox.UseSystemPasswordChar -or $inputBox.MaxLength -ne 0) { throw 'MASKED_CAPTURE_FAILED' }
        $cases = @('synthetic_nfp-Abc123', 'legacy.synthetic', 'opaque+value/=~', 'x', ('z' * 2048))
        foreach ($sample in $cases) {
            $inputBox.Text = $sample
            $secret = ConvertTo-SecureString -String $inputBox.Text -AsPlainText -Force
            try {
                if ((ConvertTo-CredentialPlaintext $secret) -cne $sample) { throw 'SECURESTRING_CONVERSION_FAILED' }
                Write-CredentialFile $secret $syntheticPath
                $roundtrip = Read-CredentialFile $syntheticPath
                try { if ((ConvertTo-CredentialPlaintext $roundtrip) -cne $sample) { throw 'FILE_ROUNDTRIP_FAILED' } }
                finally { $roundtrip.Dispose() }
            } finally { $secret.Dispose(); $inputBox.Clear() }
        }
        foreach ($invalid in @('', 'has space', "line`nfeed", ('esc' + [char]27), ('unicode' + [char]233))) {
            $rejected = $false
            try { Assert-CredentialTransport $invalid } catch { $rejected = $true }
            if (-not $rejected) { throw 'INVALID_INPUT_NOT_REJECTED' }
        }
        Write-Output 'PASS: masked capture, SecureString conversion, 5 DPAPI file roundtrips, 5 invalid-input checks. No real credential read.'
    } finally {
        $inputBox.Dispose()
        if (Test-Path -LiteralPath $syntheticPath) { Remove-Item -LiteralPath $syntheticPath }
    }
    return
}
$credentialDirectory = Join-Path ([System.IO.Path]::GetTempPath()) 'tatos-remote-audit'
$credentialPath = Join-Path $credentialDirectory 'test-token.dpapi'
if ($Action -eq 'Save') {
    Add-Type -AssemblyName System.Windows.Forms
    $credentialSecret = Read-CredentialInput
    try {
        New-Item -ItemType Directory -Force -Path $credentialDirectory | Out-Null
        Write-CredentialFile $credentialSecret $credentialPath
    } finally { $credentialSecret.Dispose() }
    Write-Output 'Credencial guardada con DPAPI para este usuario de Windows. No se modifico el login del CLI.'
    return
}
$credentialSecret = Read-CredentialFile $credentialPath
$credentialPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credentialSecret)
$previousTestToken = $env:NETLIFY_AUTH_TOKEN
try {
    $env:NETLIFY_AUTH_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($credentialPointer)
    Assert-CredentialTransport $env:NETLIFY_AUTH_TOKEN
    if ($Action -eq 'Audit') { & node (Join-Path $PSScriptRoot 'diagnose-remote-auth.mjs') }
    else { & node (Join-Path $PSScriptRoot 'remote-netlify-test.mjs') }
    $credentialExitCode = $LASTEXITCODE
} finally {
    $env:NETLIFY_AUTH_TOKEN = $previousTestToken
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($credentialPointer)
    $credentialSecret.Dispose()
}
exit $credentialExitCode
