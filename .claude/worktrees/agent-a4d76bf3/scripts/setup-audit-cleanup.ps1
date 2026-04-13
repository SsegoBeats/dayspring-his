# Windows Task Scheduler Script for Audit Log Cleanup
# This script sets up automatic daily cleanup of audit logs older than 30 days

# Configuration
$CLEANUP_URL = "http://localhost:3000/api/cron/audit-cleanup"
$CLEANUP_TOKEN = "audit-cleanup-token"  # Change this to a secure token
$TASK_NAME = "DayspringHIS-AuditCleanup"
$SCRIPT_PATH = $PSScriptRoot + "\audit-cleanup.ps1"

# Create the cleanup script
$CLEANUP_SCRIPT = @"
# Audit Log Cleanup Script
`$CLEANUP_URL = "$CLEANUP_URL"
`$CLEANUP_TOKEN = "$CLEANUP_TOKEN"

try {
    `$headers = @{
        'Authorization' = "Bearer `$CLEANUP_TOKEN"
        'Content-Type' = 'application/json'
    }
    
    `$response = Invoke-RestMethod -Uri `$CLEANUP_URL -Method POST -Headers `$headers
    
    if (`$response.success) {
        Write-Host "Audit cleanup completed: `$(`$response.deletedCount) records deleted"
    } else {
        Write-Error "Audit cleanup failed: `$(`$response.error)"
    }
} catch {
    Write-Error "Failed to execute audit cleanup: `$(`$_.Exception.Message)"
}
"@

# Write the cleanup script to file
$CLEANUP_SCRIPT | Out-File -FilePath $SCRIPT_PATH -Encoding UTF8

# Create scheduled task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File `"$SCRIPT_PATH`""
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"  # Run daily at 2 AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

try {
    # Remove existing task if it exists
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
    
    # Register the new task
    Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily cleanup of Dayspring HIS audit logs older than 30 days"
    
    Write-Host "✅ Scheduled task '$TASK_NAME' created successfully!"
    Write-Host "📅 Task will run daily at 2:00 AM"
    Write-Host "📁 Cleanup script saved to: $SCRIPT_PATH"
    Write-Host ""
    Write-Host "To manually run the cleanup:"
    Write-Host "  PowerShell -File `"$SCRIPT_PATH`""
    Write-Host ""
    Write-Host "To view the task:"
    Write-Host "  Get-ScheduledTask -TaskName '$TASK_NAME'"
    Write-Host ""
    Write-Host "To remove the task:"
    Write-Host "  Unregister-ScheduledTask -TaskName '$TASK_NAME' -Confirm:`$false"
    
} catch {
    Write-Error "Failed to create scheduled task: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Manual setup instructions:"
    Write-Host "1. Open Task Scheduler"
    Write-Host "2. Create Basic Task"
    Write-Host "3. Name: $TASK_NAME"
    Write-Host "4. Trigger: Daily at 2:00 AM"
    Write-Host "5. Action: Start Program"
    Write-Host "6. Program: PowerShell.exe"
    Write-Host "7. Arguments: -File `"$SCRIPT_PATH`""
}
