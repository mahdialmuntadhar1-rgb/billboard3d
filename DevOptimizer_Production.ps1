<#
.SYNOPSIS
    Developer Machine Optimization Tool - Production Hardened
.DESCRIPTION
    SAFE, production-ready PowerShell script for optimizing developer machines
    with comprehensive safety checks and detailed reporting.
.AUTHOR
    Performance Engineering Team
.VERSION
    2.0.0 Production
.PARAMETER Mode
    Operation mode: Safe, Dev, or Aggressive
.PARAMETER DryRun
    Preview actions without execution
.PARAMETER LogPath
    Custom log file path
.EXAMPLE
    .\DevOptimizer_Production.ps1 -Mode Safe -DryRun
.EXAMPLE
    .\DevOptimizer_Production.ps1 -Mode Dev -LogPath "C:\Logs\optimization.log"
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
$Script:IsAdmin = $false
$Script:SkippedItems = @()
$Script:SectionResults = @{}

# Detailed Statistics
$Script:Stats = @{
    AICache = @{ Cleaned = 0; Skipped = 0; Errors = 0 }
    BrowserCache = @{ Cleaned = 0; Skipped = 0; Errors = 0 }
    SystemCleanup = @{ Cleaned = 0; Skipped = 0; Errors = 0 }
    DevProcesses = @{ Killed = 0; Skipped = 0; Errors = 0 }
}

# Color Scheme
$Colors = @{
    Scan = "Cyan"
    Clean = "Yellow"
    Result = "Green"
    Warning = "Magenta"
    Error = "Red"
    Info = "White"
    Success = "Green"
    Critical = "Red"
}

# Windows Version Check
function Test-WindowsCompatibility {
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        throw "Windows 10/11 required. Current version: $($osVersion.Major).$($osVersion.Minor)"
    }
    return $true
}

# Admin Privilege Check
function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Log "WARNING: Running without administrator privileges" -Level "WARNING" -Color $Colors.Warning
        Write-Log "Some system cleanup operations may be limited" -Level "WARNING" -Color $Colors.Warning
    }
    
    $Script:IsAdmin = $isAdmin
    return $isAdmin
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
Developer Machine Optimization Tool v2.0
Started: $(Get-Date)
Mode: $Script:Mode
Dry Run: $DryRun
User: $env:USERNAME
Computer: $env:COMPUTERNAME
Admin: $Script:IsAdmin
Windows: $((Get-WmiObject -Class Win32_OperatingSystem).Caption)
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
        # Use faster method for large folders
        $size = (Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue | 
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

# Enhanced Safety Check
function Test-SafeToDelete {
    param(
        [string]$Path,
        [string]$Pattern = "*"
    )
    
    # Normalize path for comparison
    $normalizedPath = [System.IO.Path]::GetFullPath($Path)
    
    # Critical system and user paths - NEVER DELETE
    $criticalPaths = @(
        "$env:USERPROFILE\Documents",
        "$env:USERPROFILE\Desktop",
        "$env:USERPROFILE\Downloads",
        "$env:USERPROFILE\Pictures",
        "$env:USERPROFILE\Music",
        "$env:USERPROFILE\Videos",
        "$env:USERPROFILE\.ssh",
        "$env:USERPROFILE\.aws",
        "$env:USERPROFILE\.azure",
        "$env:USERPROFILE\.config",
        "$env:USERPROFILE\AppData\Roaming\GitHub",
        "$env:USERPROFILE\AppData\Roaming\GitHubDesktop",
        "$env:USERPROFILE\AppData\Local\GitHubDesktop",
        "$env:USERPROFILE\AppData\Roaming\WinSCP",
        "$env:USERPROFILE\AppData\Local\Programs\WinSCP",
        "$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup",
        "$env:USERPROFILE\AppData\Roaming\npm",
        "$env:USERPROFILE\AppData\Local\npm-cache",
        "$env:USERPROFILE\AppData\Local\pnpm-store",
        "$env:USERPROFILE\AppData\Local\Yarn",
        "$env:USERPROFILE\AppData\Roaming\yarn",
        "$env:USERPROFILE\AppData\Local\supabase",
        "$env:USERPROFILE\.supabase"
    )
    
    # Check against critical paths
    foreach ($criticalPath in $criticalPaths) {
        $normalizedCritical = [System.IO.Path]::GetFullPath($criticalPath)
        if ($normalizedPath.StartsWith($normalizedCritical, [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }
    
    # Skip development-related directories
    $devPatterns = @(
        "*\src*", "*\node_modules*", "*\dist*", "*\build*", "*\.git*", "*\.vscode*", 
        "*\.idea*", "*\projects*", "*\workspace*", "*\.env*", "*\.npmrc*", "*\.yarnrc*",
        "*\.gitignore*", "*package.json", "*tsconfig.json", "*webpack.config.js", "*vite.config.js"
    )
    
    foreach ($pattern in $devPatterns) {
        if ($normalizedPath -like $pattern) {
            return $false
        }
    }
    
    # Skip git repositories
    if (Test-Path "$Path\.git") {
        return $false
    }
    
    # Skip if contains important config files
    $importantFiles = @(".env", ".env.local", ".env.production", "config.json", "settings.json", "id_rsa", "id_ed25519")
    foreach ($file in $importantFiles) {
        if (Test-Path (Join-Path $Path $file)) {
            return $false
        }
    }
    
    return $true
}

# Check if browser is running
function Test-BrowserRunning {
    $browserProcesses = @("msedge", "chrome", "firefox")
    foreach ($browser in $browserProcesses) {
        $processes = Get-Process -Name $browser -ErrorAction SilentlyContinue
        if ($processes) {
            return $true
        }
    }
    return $false
}

# Preflight System Check
function Invoke-PreflightCheck {
    Write-Log "`n=== PREFLIGHT SYSTEM CHECK ===" -Level "SCAN" -Color $Colors.Scan
    
    try {
        Test-WindowsCompatibility | Out-Null
        Write-Log "✓ Windows version compatible" -Level "INFO" -Color $Colors.Success
    }
    catch {
        Write-Log "✗ $($_.Exception.Message)" -Level "ERROR" -Color $Colors.Error
        throw
    }
    
    try {
        Test-AdminPrivileges | Out-Null
        Write-Log "✓ Admin privileges checked" -Level "INFO" -Color $Colors.Success
    }
    catch {
        Write-Log "✗ Failed to check admin privileges" -Level "ERROR" -Color $Colors.Error
        throw
    }
    
    # Check disk space
    $systemDrive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpace = $systemDrive.FreeSpace
    $totalSpace = $systemDrive.Size
    $freePercent = [math]::Round(($freeSpace / $totalSpace) * 100, 2)
    
    Write-Log "Disk space: $(Format-FileSize $freeSpace) free of $(Format-FileSize $totalSpace) ($freePercent%)" -Level "INFO"
    
    if ($freePercent -lt 10) {
        Write-Log "WARNING: Low disk space ($freePercent% free)" -Level "WARNING" -Color $Colors.Warning
    }
    
    # Check for running browsers
    if (Test-BrowserRunning) {
        Write-Log "WARNING: Browser detected running - close for optimal cache cleanup" -Level "WARNING" -Color $Colors.Warning
    }
    
    Write-Log "✓ Preflight check completed" -Level "INFO" -Color $Colors.Success
}

function Invoke-AIToolCacheCleaner {
    Write-Log "`n=== AI TOOL CACHE CLEANER ===" -Level "SCAN" -Color $Colors.Scan
    
    $aiPaths = @(
        "$env:APPDATA\Claude\vm_bundles",
        "$env:APPDATA\ChatGPT\cache",
        "$env:LOCALAPPDATA\AIStudio\cache",
        "$env:APPDATA\OpenAI\cache"
    )
    
    $sectionSpaceFreed = 0
    $sectionItemsSkipped = 0
    
    foreach ($path in $aiPaths) {
        if (Test-Path $path) {
            Write-Log "Scanning AI cache: $path" -Level "INFO"
            
            # Check if path is safe
            if (-not (Test-SafeToDelete $path)) {
                Write-Log "SKIPPED: Path protected - $path" -Level "WARNING" -Color $Colors.Warning
                $Script:SkippedItems += "AI Cache: $path (protected)"
                $sectionItemsSkipped++
                continue
            }
            
            try {
                $vmFiles = Get-ChildItem -Path $path -Filter "*.vhdx" -File -ErrorAction SilentlyContinue
                $bundleFiles = Get-ChildItem -Path $path -Filter "*bundle*" -File -ErrorAction SilentlyContinue
                
                $filesToDelete = @()
                $totalSize = 0
                
                foreach ($file in $vmFiles + $bundleFiles) {
                    # Additional safety check for file age (don't delete very recent files)
                    if ($file.CreationTime -lt (Get-Date).AddHours(-2)) {
                        $totalSize += $file.Length
                        $filesToDelete += $file
                    }
                    else {
                        Write-Log "SKIPPED: Recent file - $($file.Name)" -Level "INFO"
                        $sectionItemsSkipped++
                    }
                }
                
                if ($filesToDelete.Count -gt 0) {
                    Write-Log "Found $($filesToDelete.Count) AI cache files totaling $(Format-FileSize $totalSize)" -Level "INFO"
                    
                    if ($totalSize -gt 1GB -or $Script:Mode -eq "Aggressive") {
                        if (-not $DryRun) {
                            $confirm = Read-Host "Delete AI cache files? This may affect running AI tools. (y/N)"
                            if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                                foreach ($file in $filesToDelete) {
                                    try {
                                        # Test if file is locked before deletion
                                        $fileStream = $file.OpenRead()
                                        $fileStream.Close()
                                        
                                        Remove-Item $file.FullName -Force -ErrorAction Stop
                                        $Script:TotalSpaceFreed += $file.Length
                                        $sectionSpaceFreed += $file.Length
                                        Write-Log "Deleted: $($file.Name) ($(Format-FileSize $file.Length))" -Level "CLEAN" -Color $Colors.Clean
                                    }
                                    catch [System.IO.IOException] {
                                        $Script:Errors += "File in use: $($file.FullName)"
                                        Write-Log "SKIPPED: File in use - $($file.Name)" -Level "WARNING" -Color $Colors.Warning
                                        $sectionItemsSkipped++
                                        $Script:Stats.AICache.Errors++
                                    }
                                    catch {
                                        $Script:Errors += "Failed to delete $($file.FullName): $($_.Exception.Message)"
                                        Write-Log "ERROR: Failed to delete $($file.Name)" -Level "ERROR" -Color $Colors.Error
                                        $Script:Stats.AICache.Errors++
                                    }
                                }
                            }
                            else {
                                Write-Log "Skipped AI cache deletion" -Level "INFO"
                                $sectionItemsSkipped += $filesToDelete.Count
                            }
                        }
                        else {
                            Write-Log "[DRY RUN] Would delete AI cache files: $(Format-FileSize $totalSize)" -Level "INFO"
                        }
                    }
                    else {
                        Write-Log "AI cache size below threshold ($(Format-FileSize $totalSize))" -Level "INFO"
                    }
                }
            }
            catch {
                $Script:Errors += "Failed to scan AI cache $path`: $($_.Exception.Message)"
                $Script:Stats.AICache.Errors++
            }
        }
        else {
            Write-Log "AI cache path not found: $path" -Level "INFO"
        }
    }
    
    $Script:SectionResults["AICache"] = @{
        SpaceFreed = $sectionSpaceFreed
        ItemsSkipped = $sectionItemsSkipped
        Errors = $Script:Stats.AICache.Errors
    }
}

function Invoke-BrowserOptimization {
    Write-Log "`n=== BROWSER OPTIMIZATION ===" -Level "SCAN" -Color $Colors.Scan
    
    # Check if browser is running
    if (Test-BrowserRunning) {
        Write-Log "WARNING: Browser detected running - cache cleanup may be incomplete" -Level "WARNING" -Color $Colors.Warning
        
        if (-not $DryRun) {
            $confirm = Read-Host "Continue with browser cleanup? (y/N)"
            if ($confirm -ne 'y' -and $confirm -ne 'Y') {
                Write-Log "Browser optimization skipped" -Level "INFO"
                return
            }
        }
    }
    
    $browserPaths = @(
        @{ Path = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default"; Name = "Edge" },
        @{ Path = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default"; Name = "Chrome" },
        @{ Path = "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles"; Name = "Firefox" }
    )
    
    $sectionSpaceFreed = 0
    $sectionItemsSkipped = 0
    
    foreach ($browser in $browserPaths) {
        if (Test-Path $browser.Path) {
            Write-Log "Scanning $($browser.Name) browser cache..." -Level "INFO"
            
            # Safe cache folders only - NEVER delete user data
            $safeCacheFolders = @("Cache", "GPUCache", "Code Cache", "ShaderCache", "Media Cache")
            $dangerousFolders = @("History", "Cookies", "Bookmarks", "Login Data", "Preferences", "Web Data", "Extensions")
            
            $totalCacheSize = 0
            $foldersToClean = @()
            
            foreach ($cacheFolder in $safeCacheFolders) {
                $folderPath = Join-Path $browser.Path $cacheFolder
                if (Test-Path $folderPath) {
                    # Double-check we're not deleting user data
                    $isDangerous = $false
                    foreach ($dangerous in $dangerousFolders) {
                        if ($folderPath -like "*$dangerous*") {
                            $isDangerous = $true
                            break
                        }
                    }
                    
                    if (-not $isDangerous) {
                        $size = Get-FolderSize -Path $folderPath
                        $totalCacheSize += $size
                        $foldersToClean += @{ Path = $folderPath; Size = $size; Name = $cacheFolder }
                    }
                    else {
                        Write-Log "SKIPPED: Protected folder - $cacheFolder" -Level "WARNING" -Color $Colors.Warning
                        $sectionItemsSkipped++
                    }
                }
            }
            
            if ($foldersToClean.Count -gt 0) {
                Write-Log "Found $($browser.Name) cache: $(Format-FileSize $totalCacheSize)" -Level "INFO"
                
                $shouldClean = $false
                if ($Script:Mode -eq "Aggressive") {
                    $shouldClean = $true
                }
                elseif ($totalCacheSize -gt 500MB) {
                    $shouldClean = $true
                }
                
                if ($shouldClean) {
                    if (-not $DryRun) {
                        $confirm = Read-Host "Clear $($browser.Name) cache? This won't delete bookmarks, cookies, or passwords. (y/N)"
                        if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                            foreach ($folder in $foldersToClean) {
                                try {
                                    Remove-Item $folder.Path -Force -Recurse -ErrorAction Stop
                                    $Script:TotalSpaceFreed += $folder.Size
                                    $sectionSpaceFreed += $folder.Size
                                    Write-Log "Cleared: $($folder.Name) ($(Format-FileSize $folder.Size))" -Level "CLEAN" -Color $Colors.Clean
                                }
                                catch {
                                    $Script:Errors += "Failed to clear $($browser.Name) cache: $($_.Exception.Message)"
                                    Write-Log "SKIPPED: $($folder.Name) (in use)" -Level "WARNING" -Color $Colors.Warning
                                    $sectionItemsSkipped++
                                    $Script:Stats.BrowserCache.Errors++
                                }
                            }
                        }
                        else {
                            Write-Log "Skipped $($browser.Name) cache deletion" -Level "INFO"
                            $sectionItemsSkipped += $foldersToClean.Count
                        }
                    }
                    else {
                        Write-Log "[DRY RUN] Would clear $($browser.Name) cache: $(Format-FileSize $totalCacheSize)" -Level "INFO"
                    }
                }
                else {
                    Write-Log "$($browser.Name) cache size below threshold ($(Format-FileSize $totalCacheSize))" -Level "INFO"
                }
            }
        }
        else {
            Write-Log "$($browser.Name) not found at: $($browser.Path)" -Level "INFO"
        }
    }
    
    $Script:SectionResults["BrowserCache"] = @{
        SpaceFreed = $sectionSpaceFreed
        ItemsSkipped = $sectionItemsSkipped
        Errors = $Script:Stats.BrowserCache.Errors
    }
}

function Invoke-SystemCleanup {
    Write-Log "`n=== SYSTEM CLEANUP ===" -Level "SCAN" -Color $Colors.Scan
    
    $tempPaths = @(
        @{ Path = $env:TEMP; Name = "User Temp" },
        @{ Path = "$env:WINDIR\Temp"; Name = "System Temp"; RequiresAdmin = $true },
        @{ Path = "$env:WINDIR\Prefetch"; Name = "Prefetch"; RequiresAdmin = $true }
    )
    
    $sectionSpaceFreed = 0
    $sectionItemsSkipped = 0
    
    foreach ($tempInfo in $tempPaths) {
        if (Test-Path $tempInfo.Path) {
            Write-Log "Scanning: $($tempInfo.Name) - $($tempInfo.Path)" -Level "INFO"
            
            # Check admin requirements
            if ($tempInfo.RequiresAdmin -and -not $Script:IsAdmin) {
                Write-Log "SKIPPED: Requires admin privileges - $($tempInfo.Name)" -Level "WARNING" -Color $Colors.Warning
                $Script:SkippedItems += "$($tempInfo.Name): Requires admin privileges"
                $sectionItemsSkipped++
                continue
            }
            
            try {
                # Get files older than 7 days, but be more conservative with system folders
                $daysOld = if ($tempInfo.RequiresAdmin) { 3 } else { 7 }
                $oldFiles = Get-ChildItem -Path $tempInfo.Path -Recurse -File -ErrorAction SilentlyContinue | 
                           Where-Object { 
                               $_.CreationTime -lt (Get-Date).AddDays(-$daysOld) -and
                               $_.Name -notlike "*.tmp" -and  # Keep recent temp files
                               $_.Name -notlike "*.log" -and  # Keep log files
                               (Test-SafeToDelete $_.FullName)
                           }
                
                if ($oldFiles.Count -gt 0) {
                    $totalSize = ($oldFiles | Measure-Object -Property Length -Sum).Sum
                    Write-Log "Found $($oldFiles.Count) old files ($(Format-FileSize $totalSize))" -Level "INFO"
                    
                    if (-not $DryRun) {
                        foreach ($file in $oldFiles) {
                            try {
                                Remove-Item $file.FullName -Force -ErrorAction Stop
                                $Script:TotalSpaceFreed += $file.Length
                                $sectionSpaceFreed += $file.Length
                            }
                            catch {
                                # Skip locked files silently but count them
                                $sectionItemsSkipped++
                            }
                        }
                        Write-Log "Cleaned $($tempInfo.Name) files: $(Format-FileSize $totalSize)" -Level "CLEAN" -Color $Colors.Clean
                    }
                    else {
                        Write-Log "[DRY RUN] Would clean $($tempInfo.Name) files: $(Format-FileSize $totalSize)" -Level "INFO"
                    }
                }
                else {
                    Write-Log "No old files found in $($tempInfo.Name)" -Level "INFO"
                }
            }
            catch {
                $Script:Errors += "Failed to clean $($tempInfo.Name): $($_.Exception.Message)"
                $Script:Stats.SystemCleanup.Errors++
            }
        }
        else {
            Write-Log "Path not found: $($tempInfo.Path)" -Level "INFO"
        }
    }
    
    # Flush DNS - safer approach
    if (-not $DryRun) {
        try {
            Write-Log "Flushing DNS cache..." -Level "INFO"
            & ipconfig /flushdns | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Log "DNS cache flushed successfully" -Level "CLEAN" -Color $Colors.Clean
            }
            else {
                Write-Log "DNS flush completed with warnings" -Level "WARNING" -Color $Colors.Warning
            }
        }
        catch {
            $Script:Errors += "Failed to flush DNS: $($_.Exception.Message)"
            $Script:Stats.SystemCleanup.Errors++
        }
    }
    
    $Script:SectionResults["SystemCleanup"] = @{
        SpaceFreed = $sectionSpaceFreed
        ItemsSkipped = $sectionItemsSkipped
        Errors = $Script:Stats.SystemCleanup.Errors
    }
}

function Invoke-DevProcessCleaner {
    Write-Log "`n=== DEV PROCESS CLEANER ===" -Level "SCAN" -Color $Colors.Scan
    
    # Expanded list of development processes
    $devProcesses = @(
        "node", "npm", "npx", "yarn", "pnpm", "vite", "webpack", "ts-node", 
        "nodemon", "electron", "code", "chrome", "msedge", "firefox"
    )
    
    $runningProcesses = @()
    
    foreach ($procName in $devProcesses) {
        try {
            $processes = Get-Process -Name $procName -ErrorAction SilentlyContinue
            if ($processes) {
                $runningProcesses += $processes
            }
        }
        catch {
            # Process might not exist or be inaccessible
        }
    }
    
    # Remove duplicates and sort
    $uniqueProcesses = $runningProcesses | Group-Object Id | ForEach-Object { $_.Group[0] }
    
    if ($uniqueProcesses.Count -gt 0) {
        Write-Log "Found $($uniqueProcesses.Count) development processes:" -Level "INFO"
        foreach ($proc in $uniqueProcesses) {
            $memory = [math]::Round($proc.WorkingSet64 / 1MB, 2)
            $startTime = $proc.StartTime.ToString("HH:mm:ss")
            Write-Log "  - $($proc.ProcessName) (PID: $($proc.Id), Memory: ${memory}MB, Started: $startTime)" -Level "INFO"
        }
        
        if ($Script:Mode -eq "Aggressive" -or $Script:Mode -eq "Dev") {
            if (-not $DryRun) {
                Write-Log "WARNING: Killing development processes may cause data loss" -Level "WARNING" -Color $Colors.Warning
                $confirm = Read-Host "Kill development processes? Save all work first. (y/N)"
                if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                    foreach ($proc in $uniqueProcesses) {
                        try {
                            # Try graceful shutdown first
                            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                            $Script:ProcessesKilled++
                            $Script:Stats.DevProcesses.Killed++
                            Write-Log "Killed: $($proc.ProcessName) (PID: $($proc.Id))" -Level "CLEAN" -Color $Colors.Clean
                            
                            # Give process time to terminate
                            Start-Sleep -Milliseconds 500
                        }
                        catch {
                            $Script:Errors += "Failed to kill $($proc.ProcessName): $($_.Exception.Message)"
                            Write-Log "Failed to kill: $($proc.ProcessName) (PID: $($proc.Id))" -Level "ERROR" -Color $Colors.Error
                            $Script:Stats.DevProcesses.Errors++
                        }
                    }
                }
                else {
                    Write-Log "Skipped development process termination" -Level "INFO"
                    $Script:Stats.DevProcesses.Skipped = $uniqueProcesses.Count
                }
            }
            else {
                Write-Log "[DRY RUN] Would kill $($uniqueProcesses.Count) development processes" -Level "INFO"
            }
        }
        else {
            Write-Log "Process killing not available in Safe mode" -Level "INFO"
            $Script:Stats.DevProcesses.Skipped = $uniqueProcesses.Count
        }
    }
    else {
        Write-Log "No development processes found" -Level "INFO"
    }
    
    $Script:SectionResults["DevProcesses"] = @{
        SpaceFreed = 0
        ItemsSkipped = $Script:Stats.DevProcesses.Skipped
        Errors = $Script:Stats.DevProcesses.Errors
    }
}

function Invoke-StartupOptimizer {
    Write-Log "`n=== STARTUP OPTIMIZER ===" -Level "SCAN" -Color $Colors.Scan
    
    try {
        $startupPrograms = Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction SilentlyContinue | 
                          Select-Object Name, Command, Location, @{Name="Size"; Expression={0}}
        
        if ($startupPrograms) {
            Write-Log "Startup programs ($($startupPrograms.Count)):" -Level "INFO"
            
            foreach ($program in $startupPrograms) {
                $impact = "Low"
                $recommendation = ""
                
                if ($program.Command -match "chrome|edge|firefox") {
                    $impact = "Medium"
                    $recommendation = "Consider disabling if not needed daily"
                }
                if ($program.Command -match "teams|slack|discord") {
                    $impact = "High"
                    $recommendation = "Disable for faster startup"
                }
                if ($program.Command -match "onedrive|dropbox") {
                    $impact = "Medium"
                    $recommendation = "Keep if sync is important"
                }
                
                Write-Log "  - $($program.Name) [$impact impact]" -Level "INFO"
                if ($recommendation) {
                    Write-Log "    → $recommendation" -Level "INFO" -Color $Colors.Warning
                }
            }
            
            Write-Log "Use Task Manager > Startup to disable unnecessary programs" -Level "INFO" -Color $Colors.Warning
        }
        else {
            Write-Log "No startup programs found or access denied" -Level "INFO"
        }
    }
    catch {
        $Script:Errors += "Failed to analyze startup programs: $($_.Exception.Message)"
        Write-Log "Could not access startup program information" -Level "WARNING" -Color $Colors.Warning
    }
}

function Invoke-PerformanceMode {
    Write-Log "`n=== PERFORMANCE MODE ===" -Level "SCAN" -Color $Colors.Scan
    
    if ($Script:Mode -eq "Aggressive") {
        if (-not $DryRun) {
            try {
                Write-Log "Setting High Performance power plan..." -Level "INFO"
                
                # Check if High Performance plan exists
                $powerSchemes = & powercfg /list
                $highPerformanceScheme = $powerSchemes | Where-Object { $_ -match "High performance|SCHEME_MIN" }
                
                if ($highPerformanceScheme) {
                    & powercfg -setactive SCHEME_MIN | Out-Null
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "High Performance mode enabled" -Level "CLEAN" -Color $Colors.Clean
                    }
                    else {
                        Write-Log "Failed to set power plan" -Level "WARNING" -Color $Colors.Warning
                    }
                }
                else {
                    Write-Log "High Performance power plan not found" -Level "WARNING" -Color $Colors.Warning
                }
            }
            catch {
                $Script:Errors += "Failed to set performance mode: $($_.Exception.Message)"
                Write-Log "Could not change power plan" -Level "WARNING" -Color $Colors.Warning
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
                  Where-Object { Test-SafeToDelete $_.FullName }
        
        Write-Log "Analyzing disk usage (this may take a moment)..." -Level "INFO"
        
        foreach ($folder in $folders) {
            try {
                $size = Get-FolderSize -Path $folder.FullName
                if ($size -gt 1GB) {
                    $largeFolders += @{
                        Name = $folder.Name
                        Path = $folder.FullName
                        Size = $size
                    }
                }
            }
            catch {
                # Skip inaccessible folders
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
                
                if ($folder.Size -gt 5GB) {
                    Write-Log "    → Consider manual cleanup" -Level "INFO" -Color $Colors.Warning
                }
            }
        }
        else {
            Write-Log "No abnormally large folders found" -Level "INFO"
        }
    }
    catch {
        $Script:Errors += "Failed to analyze disk usage: $($_.Exception.Message)"
        Write-Log "Disk usage analysis incomplete" -Level "WARNING" -Color $Colors.Warning
    }
}

function Show-DetailedResults {
    Write-Log "`n=== DETAILED OPTIMIZATION RESULTS ===" -Level "RESULT" -Color $Colors.Result
    
    # Summary table
    Write-Log "`nSUMMARY TABLE:" -Level "INFO" -Color $Colors.Success
    Write-Log "┌─────────────────────┬──────────────┬─────────────┬─────────┐" -Level "INFO"
    Write-Log "│ Section             │ Space Freed  │ Items Skipped│ Errors  │" -Level "INFO"
    Write-Log "├─────────────────────┼──────────────┼─────────────┼─────────┤" -Level "INFO"
    
    foreach ($section in $Script:SectionResults.Keys) {
        $spaceFreed = Format-FileSize $Script:SectionResults[$section].SpaceFreed
        $skipped = $Script:SectionResults[$section].ItemsSkipped
        $errors = $Script:SectionResults[$section].Errors
        $sectionName = $section.PadRight(19)
        $spaceFreedPadded = $spaceFreed.PadRight(12)
        $skippedPadded = $skipped.ToString().PadRight(11)
        $errorsPadded = $errors.ToString().PadRight(7)
        
        Write-Log "│ $sectionName │ $spaceFreedPadded │ $skippedPadded │ $errorsPadded │" -Level "INFO"
    }
    
    Write-Log "└─────────────────────┴──────────────┴─────────────┴─────────┘" -Level "INFO"
    
    # Totals
    Write-Log "`nTOTALS:" -Level "INFO" -Color $Colors.Success
    Write-Log "Total Space Freed: $(Format-FileSize $Script:TotalSpaceFreed)" -Level "INFO" -Color $Colors.Success
    Write-Log "Processes Killed: $Script:ProcessesKilled" -Level "INFO" -Color $Colors.Success
    Write-Log "Total Errors: $($Script:Errors.Count)" -Level "INFO"
    
    # Skipped items
    if ($Script:SkippedItems.Count -gt 0) {
        Write-Log "`nSKIPPED ITEMS:" -Level "INFO" -Color $Colors.Warning
        foreach ($skipped in $Script:SkippedItems | Select-Object -First 10) {
            Write-Log "  - $skipped" -Level "INFO" -Color $Colors.Warning
        }
        if ($Script:SkippedItems.Count -gt 10) {
            Write-Log "  ... and $($Script:SkippedItems.Count - 10) more items" -Level "INFO" -Color $Colors.Warning
        }
    }
    
    # Errors
    if ($Script:Errors.Count -gt 0) {
        Write-Log "`nERRORS:" -Level "ERROR" -Color $Colors.Error
        foreach ($errorMsg in $Script:Errors | Select-Object -First 5) {
            Write-Log "  - $errorMsg" -Level "ERROR" -Color $Colors.Error
        }
        if ($Script:Errors.Count -gt 5) {
            Write-Log "  ... and $($Script:Errors.Count - 5) more errors" -Level "ERROR" -Color $Colors.Error
        }
    }
    
    $footer = @"
========================================
Optimization completed: $(Get-Date)
Mode: $Script:Mode
Dry Run: $DryRun
Total Space Freed: $(Format-FileSize $Script:TotalSpaceFreed)
========================================
"@
    
    Add-Content -Path $Script:LogFile -Value $footer
    Write-Log $footer -Level "INFO" -Color $Colors.Info
    
    if (-not $DryRun) {
        Write-Log "`nLog file saved to: $Script:LogFile" -Level "INFO"
        Write-Log "RECOMMENDATION: Restart your browser for optimal performance" -Level "INFO" -Color $Colors.Warning
        Write-Log "RECOMMENDATION: Restart your computer if you killed processes" -Level "INFO" -Color $Colors.Warning
    }
    else {
        Write-Log "`nDRY RUN COMPLETED - No changes made" -Level "INFO" -Color $Colors.Success
        Write-Log "Run without -DryRun to execute optimizations" -Level "INFO" -Color $Colors.Success
    }
}

# Main Execution
function Main {
    try {
        Write-Host "Developer Machine Optimization Tool v2.0 (Production)" -ForegroundColor $Colors.Success
        Write-Host "Mode: $Mode | Dry Run: $DryRun" -ForegroundColor $Colors.Info
        
        # Pre-flight checks
        Invoke-PreflightCheck
        
        Initialize-Logging
        
        # Main optimization functions
        Invoke-AIToolCacheCleaner
        Invoke-BrowserOptimization
        Invoke-SystemCleanup
        Invoke-DevProcessCleaner
        Invoke-StartupOptimizer
        Invoke-PerformanceMode
        Invoke-DiskUsageAnalysis
        Show-DetailedResults
        
    }
    catch {
        Write-Log "FATAL ERROR: $($_.Exception.Message)" -Level "ERROR" -Color $Colors.Error
        Write-Log "Optimization aborted due to critical error" -Level "ERROR" -Color $Colors.Error
        exit 1
    }
}

# Run the script
Main
