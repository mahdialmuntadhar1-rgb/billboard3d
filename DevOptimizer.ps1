<#
.SYNOPSIS
    Developer Machine Optimization Tool
.DESCRIPTION
    Safe, production-ready PowerShell script for optimizing developer machines
    with AI tools, web development, and browser performance.
.AUTHOR
    Performance Engineering Team
.VERSION
    1.0.0
.PARAMETER Mode
    Operation mode: Safe, Dev, or Aggressive
.PARAMETER DryRun
    Preview actions without executing
.PARAMETER LogPath
    Custom log file path
.EXAMPLE
    .\DevOptimizer.ps1 -Mode Safe -DryRun
.EXAMPLE
    .\DevOptimizer.ps1 -Mode Dev -LogPath "C:\Logs\optimization.log"
#>

[CmdletBinding()]
param(
    [ValidateSet("Safe", "Dev", "Aggressive")]
    [string]$Mode = "Safe",
    
    [switch]$DryRun,
    
    [string]$LogPath = "$env:TEMP\DevOptimizer_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
)

# Global Variables
$Script:LogFile = $LogPath
$Script:TotalSpaceFreed = 0
$Script:ProcessesKilled = 0
$Script:Errors = @()
$Script:Mode = $Mode

# Color Scheme
$Colors = @{
    Scan = "Cyan"
    Clean = "Yellow"
    Result = "Green"
    Warning = "Magenta"
    Error = "Red"
    Info = "White"
    Success = "Green"
}

# Initialize Logging
function Initialize-Logging {
    param()
    
    $logDir = Split-Path $Script:LogFile -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    $header = @"
========================================
Developer Machine Optimization Tool
Started: $(Get-Date)
Mode: $Script:Mode
Dry Run: $DryRun
User: $env:USERNAME
Computer: $env:COMPUTERNAME
========================================
"@
    
    Add-Content -Path $Script:LogFile -Value $header
    Write-Host $header -ForegroundColor $Colors.Info
}

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Color = $Colors.Info
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    Add-Content -Path $Script:LogFile -Value $logEntry
    Write-Host $Message -ForegroundColor $Color
}

function Get-FolderSize {
    param(
        [string]$Path
    )
    
    if (-not (Test-Path $Path)) {
        return 0
    }
    
    try {
        $size = (Get-ChildItem -Path $Path -Recurse -ErrorAction SilentlyContinue | 
                Measure-Object -Property Length -Sum).Sum
        return $size
    }
    catch {
        return 0
    }
}

function Format-FileSize {
    param([long]$Size)
    
    if ($Size -ge 1TB) {
        return "{0:N2} TB" -f ($Size / 1TB)
    }
    elseif ($Size -ge 1GB) {
        return "{0:N2} GB" -f ($Size / 1GB)
    }
    elseif ($Size -ge 1MB) {
        return "{0:N2} MB" -f ($Size / 1MB)
    }
    elseif ($Size -ge 1KB) {
        return "{0:N2} KB" -f ($Size / 1KB)
    }
    else {
        return "$Size bytes"
    }
}

function Test-SafeToDelete {
    param(
        [string]$Path,
        [string]$Pattern = "*"
    )
    
    # Skip critical directories
    $criticalPaths = @(
        "$env:USERPROFILE\Documents",
        "$env:USERPROFILE\Desktop",
        "$env:USERPROFILE\Downloads",
        "$env:USERPROFILE\.ssh",
        "$env:USERPROFILE\.aws",
        "$env:USERPROFILE\.azure"
    )
    
    foreach ($criticalPath in $criticalPaths) {
        if ($Path.StartsWith($criticalPath, [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }
    
    # Skip git repositories
    if (Test-Path "$Path\.git") {
        return $false
    }
    
    # Skip .env files
    if ($Path -like "*\.env*") {
        return $false
    }
    
    return $true
}

function Invoke-AIToolCacheCleaner {
    Write-Log "`n=== AI TOOL CACHE CLEANER ===" -Level "SCAN" -Color $Colors.Scan
    
    $aiPaths = @(
        "$env:APPDATA\Claude\vm_bundles",
        "$env:APPDATA\ChatGPT\cache",
        "$env:LOCALAPPDATA\AIStudio\cache",
        "$env:APPDATA\OpenAI\cache"
    )
    
    foreach ($path in $aiPaths) {
        if (Test-Path $path) {
            Write-Log "Scanning AI cache: $path" -Level "INFO"
            
            $vmFiles = Get-ChildItem -Path $path -Filter "*.vhdx" -ErrorAction SilentlyContinue
            $bundleFiles = Get-ChildItem -Path $path -Filter "*bundle*" -ErrorAction SilentlyContinue
            
            $totalSize = 0
            $filesToDelete = @()
            
            foreach ($file in $vmFiles + $bundleFiles) {
                $totalSize += $file.Length
                $filesToDelete += $file
            }
            
            if ($filesToDelete.Count -gt 0) {
                Write-Log "Found $($filesToDelete.Count) AI cache files totaling $(Format-FileSize $totalSize)" -Level "INFO"
                
                if ($totalSize -gt 1GB) {
                    Write-Log "WARNING: Large AI cache detected ($(Format-FileSize $totalSize))" -Level "WARNING" -Color $Colors.Warning
                    
                    if (-not $DryRun) {
                        $confirm = Read-Host "Delete AI cache files? (y/N)"
                        if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                            foreach ($file in $filesToDelete) {
                                try {
                                    Remove-Item $file.FullName -Force -Recurse -ErrorAction Stop
                                    $Script:TotalSpaceFreed += $file.Length
                                    Write-Log "Deleted: $($file.Name) ($(Format-FileSize $file.Length))" -Level "CLEAN" -Color $Colors.Clean
                                }
                                catch {
                                    $Script:Errors += "Failed to delete $($file.FullName): $($_.Exception.Message)"
                                    Write-Log "Skipped: $($file.Name) (in use)" -Level "WARNING" -Color $Colors.Warning
                                }
                            }
                        }
                        else {
                            Write-Log "Skipped AI cache deletion" -Level "INFO"
                        }
                    }
                    else {
                        Write-Log "[DRY RUN] Would delete AI cache files: $(Format-FileSize $totalSize)" -Level "INFO"
                    }
                }
            }
        }
    }
}

function Invoke-BrowserOptimization {
    Write-Log "`n=== BROWSER OPTIMIZATION ===" -Level "SCAN" -Color $Colors.Scan
    
    $edgePath = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default"
    $cacheFolders = @("Cache", "GPUCache", "Code Cache", "ShaderCache")
    
    if (Test-Path $edgePath) {
        Write-Log "Scanning Edge browser cache..." -Level "INFO"
        
        $totalCacheSize = 0
        $foldersToClean = @()
        
        foreach ($cacheFolder in $cacheFolders) {
            $folderPath = Join-Path $edgePath $cacheFolder
            if (Test-Path $folderPath) {
                $size = Get-FolderSize -Path $folderPath
                $totalCacheSize += $size
                $foldersToClean += @{ Path = $folderPath; Size = $size }
            }
        }
        
        if ($foldersToClean.Count -gt 0) {
            Write-Log "Found browser cache: $(Format-FileSize $totalCacheSize)" -Level "INFO"
            
            if ($Script:Mode -eq "Aggressive" -or $totalCacheSize -gt 500MB) {
                if (-not $DryRun) {
                    $confirm = Read-Host "Clear browser cache? This won't delete bookmarks or cookies. (y/N)"
                    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                        foreach ($folder in $foldersToClean) {
                            try {
                                Remove-Item $folder.Path -Force -Recurse -ErrorAction Stop
                                $Script:TotalSpaceFreed += $folder.Size
                                Write-Log "Cleared: $(Split-Path $folder.Path -Leaf) ($(Format-FileSize $folder.Size))" -Level "CLEAN" -Color $Colors.Clean
                            }
                            catch {
                                $Script:Errors += "Failed to clear browser cache: $($_.Exception.Message)"
                                Write-Log "Skipped: $(Split-Path $folder.Path -Leaf) (in use)" -Level "WARNING" -Color $Colors.Warning
                            }
                        }
                    }
                }
                else {
                    Write-Log "[DRY RUN] Would clear browser cache: $(Format-FileSize $totalCacheSize)" -Level "INFO"
                }
            }
        }
    }
}

function Invoke-SystemCleanup {
    Write-Log "`n=== SYSTEM CLEANUP ===" -Level "SCAN" -Color $Colors.Scan
    
    $tempPaths = @(
        $env:TEMP,
        "$env:WINDIR\Temp",
        "$env:WINDIR\Prefetch"
    )
    
    foreach ($tempPath in $tempPaths) {
        if (Test-Path $tempPath) {
            Write-Log "Scanning: $tempPath" -Level "INFO"
            
            $oldFiles = Get-ChildItem -Path $tempPath -Recurse -ErrorAction SilentlyContinue | 
                       Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) }
            
            if ($oldFiles.Count -gt 0) {
                $totalSize = ($oldFiles | Measure-Object -Property Length -Sum).Sum
                Write-Log "Found $($oldFiles.Count) old files ($(Format-FileSize $totalSize))" -Level "INFO"
                
                if (-not $DryRun) {
                    foreach ($file in $oldFiles) {
                        try {
                            Remove-Item $file.FullName -Force -Recurse -ErrorAction Stop
                            $Script:TotalSpaceFreed += $file.Length
                        }
                        catch {
                            # Skip locked files silently
                        }
                    }
                    Write-Log "Cleaned temp files: $(Format-FileSize $totalSize)" -Level "CLEAN" -Color $Colors.Clean
                }
                else {
                    Write-Log "[DRY RUN] Would clean temp files: $(Format-FileSize $totalSize)" -Level "INFO"
                }
            }
        }
    }
    
    # Flush DNS
    if (-not $DryRun) {
        try {
            Write-Log "Flushing DNS cache..." -Level "INFO"
            Start-Process "ipconfig" -ArgumentList "/flushdns" -NoNewWindow -Wait -RedirectStandardOutput "$env:TEMP\ipconfig_output.txt"
            Write-Log "DNS cache flushed" -Level "CLEAN" -Color $Colors.Clean
        }
        catch {
            $Script:Errors += "Failed to flush DNS: $($_.Exception.Message)"
        }
    }
}

function Invoke-DevProcessCleaner {
    Write-Log "`n=== DEV PROCESS CLEANER ===" -Level "SCAN" -Color $Colors.Scan
    
    $devProcesses = @("node.exe", "npm.exe", "vite.exe", "webpack.exe", "ts-node.exe")
    $runningProcesses = @()
    
    foreach ($procName in $devProcesses) {
        $processes = Get-Process -Name $procName.Replace(".exe", "") -ErrorAction SilentlyContinue
        if ($processes) {
            $runningProcesses += $processes
        }
    }
    
    if ($runningProcesses.Count -gt 0) {
        Write-Log "Found $($runningProcesses.Count) development processes:" -Level "INFO"
        foreach ($proc in $runningProcesses) {
            $memory = [math]::Round($proc.WorkingSet64 / 1MB, 2)
            Write-Log "  - $($proc.ProcessName) (PID: $($proc.Id), Memory: ${memory}MB)" -Level "INFO"
        }
        
        if ($Script:Mode -eq "Aggressive" -or $Script:Mode -eq "Dev") {
            if (-not $DryRun) {
                $confirm = Read-Host "Kill development processes? (y/N)"
                if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                    foreach ($proc in $runningProcesses) {
                        try {
                            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                            $Script:ProcessesKilled++
                            Write-Log "Killed: $($proc.ProcessName) (PID: $($proc.Id))" -Level "CLEAN" -Color $Colors.Clean
                        }
                        catch {
                            $Script:Errors += "Failed to kill $($proc.ProcessName): $($_.Exception.Message)"
                        }
                    }
                }
            }
            else {
                Write-Log "[DRY RUN] Would kill $($runningProcesses.Count) development processes" -Level "INFO"
            }
        }
    }
    else {
        Write-Log "No development processes found" -Level "INFO"
    }
}

function Invoke-StartupOptimizer {
    Write-Log "`n=== STARTUP OPTIMIZER ===" -Level "SCAN" -Color $Colors.Scan
    
    try {
        $startupPrograms = Get-CimInstance -ClassName Win32_StartupCommand | 
                          Select-Object Name, Command, Location, @{Name="Size"; Expression={0}}
        
        Write-Log "Startup programs ($($startupPrograms.Count)):" -Level "INFO"
        
        foreach ($program in $startupPrograms) {
            $impact = "Low"
            if ($program.Command -match "chrome|edge|firefox") {
                $impact = "Medium"
            }
            if ($program.Command -match "teams|slack|discord") {
                $impact = "High"
            }
            
            Write-Log "  - $($program.Name) [$impact impact]" -Level "INFO"
        }
        
        Write-Log "Consider disabling high-impact startup programs for better performance" -Level "INFO" -Color $Colors.Warning
    }
    catch {
        $Script:Errors += "Failed to analyze startup programs: $($_.Exception.Message)"
    }
}

function Invoke-PerformanceMode {
    Write-Log "`n=== PERFORMANCE MODE ===" -Level "SCAN" -Color $Colors.Scan
    
    if ($Script:Mode -eq "Aggressive") {
        if (-not $DryRun) {
            try {
                Write-Log "Setting High Performance power plan..." -Level "INFO"
                & powercfg -setactive SCHEME_MIN | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Log "High Performance mode enabled" -Level "CLEAN" -Color $Colors.Clean
                }
                else {
                    Write-Log "Failed to set power plan" -Level "WARNING" -Color $Colors.Warning
                }
            }
            catch {
                $Script:Errors += "Failed to set performance mode: $($_.Exception.Message)"
            }
        }
        else {
            Write-Log "[DRY RUN] Would enable High Performance power plan" -Level "INFO"
        }
    }
    else {
        Write-Log "Performance mode only available in Aggressive mode" -Level "INFO"
    }
}

function Invoke-DiskUsageAnalysis {
    Write-Log "`n=== DISK USAGE ANALYSIS ===" -Level "SCAN" -Color $Colors.Scan
    
    $appDataPath = $env:LOCALAPPDATA
    $largeFolders = @()
    
    try {
        $folders = Get-ChildItem -Path $appDataPath -Directory -ErrorAction SilentlyContinue | 
                  Where-Object { Test-SafeToDelete -Path $_.FullName }
        
        foreach ($folder in $folders) {
            $size = Get-FolderSize -Path $folder.FullName
            if ($size -gt 1GB) {
                $largeFolders += @{
                    Name = $folder.Name
                    Path = $folder.FullName
                    Size = $size
                }
            }
        }
        
        $largeFolders = $largeFolders | Sort-Object Size -Descending | Select-Object -First 5
        
        if ($largeFolders.Count -gt 0) {
            Write-Log "Top 5 largest AppData folders:" -Level "INFO"
            foreach ($folder in $largeFolders) {
                $sizeStr = Format-FileSize $folder.Size
                $status = if ($folder.Size -gt 5GB) { "ABNORMAL" } else { "Normal" }
                $color = if ($folder.Size -gt 5GB) { $Colors.Warning } else { $Colors.Info }
                
                Write-Log "  - $($folder.Name): $sizeStr [$status]" -Level "INFO" -Color $color
            }
        }
        else {
            Write-Log "No abnormally large folders found" -Level "INFO"
        }
    }
    catch {
        $Script:Errors += "Failed to analyze disk usage: $($_.Exception.Message)"
    }
}

function Show-Results {
    Write-Log "`n=== OPTIMIZATION RESULTS ===" -Level "RESULT" -Color $Colors.Result
    
    Write-Log "Total Space Freed: $(Format-FileSize $Script:TotalSpaceFreed)" -Level "INFO" -Color $Colors.Success
    Write-Log "Processes Killed: $Script:ProcessesKilled" -Level "INFO" -Color $Colors.Success
    Write-Log "Errors Encountered: $($Script:Errors.Count)" -Level "INFO"
    
    if ($Script:Errors.Count -gt 0) {
        Write-Log "`nErrors:" -Level "ERROR" -Color $Colors.Error
        foreach ($errorMsg in $Script:Errors) {
            Write-Log "  - $errorMsg" -Level "ERROR" -Color $Colors.Error
        }
    }
    
    $footer = @"
========================================
Optimization completed: $(Get-Date)
Mode: $Script:Mode
Dry Run: $DryRun
========================================
"@
    
    Add-Content -Path $Script:LogFile -Value $footer
    Write-Log $footer -Level "INFO" -Color $Colors.Info
    
    if (-not $DryRun) {
        Write-Log "`nLog file saved to: $Script:LogFile" -Level "INFO"
        Write-Log "Restart your browser for optimal performance" -Level "INFO" -Color $Colors.Warning
    }
}

# Main Execution
function Main {
    Write-Host "Developer Machine Optimization Tool" -ForegroundColor $Colors.Success
    Write-Host "Mode: $Mode | Dry Run: $DryRun" -ForegroundColor $Colors.Info
    
    Initialize-Logging
    
    try {
        Invoke-AIToolCacheCleaner
        Invoke-BrowserOptimization
        Invoke-SystemCleanup
        Invoke-DevProcessCleaner
        Invoke-StartupOptimizer
        Invoke-PerformanceMode
        Invoke-DiskUsageAnalysis
        Show-Results
    }
    catch {
        Write-Log "Fatal error: $($_.Exception.Message)" -Level "ERROR" -Color $Colors.Error
        exit 1
    }
}

# Run the script
Main
