# Safest Execution Commands

## 🚨 ULTIMATE SAFETY FIRST RUN

### Step 1: Test Mode (Zero Risk)
```powershell
# Run in Test Mode - simulates everything, touches nothing
.\DevOptimizer_Final_Fixed.ps1 -Mode Test -TestMode

# OR if Test Mode unavailable:
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe -DryRun
```

### Step 2: Review Test Results
- Examine all TEST MODE results
- Verify no important files marked for deletion
- Check safety report for risky conditions
- Review protected paths list

### Step 3: Safe Dry Run (Still Zero Risk)
```powershell
# Dry run in Safe mode - shows exactly what will happen
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe -DryRun
```

### Step 4: First Real Execution (Minimal Risk)
```powershell
# ONLY after test/dry run look completely safe
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe
```

## ⚠️ Claude Cache Safety Assessment

**Claude VM Bundle Deletion: CONDITIONALLY UNSAFE**

### When it's SAFE:
- Claude application is completely closed
- No Claude processes running (check Task Manager)
- System hasn't used Claude in last 2+ hours
- You have backups of important Claude conversations

### When it's RISKY:
- Claude was used within last 2 hours
- Claude processes visible in Task Manager
- System recently restarted with Claude running
- Important active conversations in Claude

### When it's UNSAFE:
- Claude is currently running
- Claude VM files are actively being written
- System is unstable or low on memory
- No backups available

**Recommendation**: Skip Claude cache deletion unless absolutely necessary

## 🛡️ Maximum Safety Protocol

### Pre-Run Checklist:
```powershell
# 1. Check running processes
Get-Process | Where-Object {$_.ProcessName -match "claude|chrome|msedge|firefox"}

# 2. Check disk space
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}}, @{Name="Free(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}

# 3. Check OneDrive status
Get-Process -Name "OneDrive" -ErrorAction SilentlyContinue

# 4. Verify backup status (manual check)
```

### Safe Execution Sequence:
```powershell
# Phase 1: Test Mode
.\DevOptimizer_Final_Fixed.ps1 -Mode Test -TestMode

# Phase 2: Dry Run (if test looks good)
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe -DryRun

# Phase 3: Safe Execution (if dry run looks good)
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe

# Phase 4: Consider Dev Mode (only if Safe worked well)
# .\DevOptimizer_Final_Fixed.ps1 -Mode Dev -DryRun
```

## 🚫 NEVER Use These Commands (High Risk)

### Dangerous Commands:
```powershell
# DON'T: Aggressive mode without testing
.\DevOptimizer_Final_Fixed.ps1 -Mode Aggressive

# DON'T: Skip dry run on first execution
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe

# DON'T: Run from System32
cd C:\Windows\System32
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe

# DON'T: Run with low disk space (<10% free)
# Check first: Get-WmiObject -Class Win32_LogicalDisk
```

## 📊 Risk Assessment by Mode

### Test Mode: ZERO RISK
- Simulates all operations
- Touches no files
- Shows decision logic
- Perfect for first run

### Safe Mode: MINIMAL RISK
- Conservative cleanup only
- No process killing
- Multiple confirmations
- Protected paths enforced

### Dev Mode: MODERATE RISK
- Optional process killing
- Standard cleanup levels
- Requires operator knowledge
- Development-aware protections

### Aggressive Mode: HIGH RISK
- Full cleanup capabilities
- Performance mode changes
- Maximum space recovery
- Expert users only

## 🔍 Emergency Commands

### If Something Goes Wrong:
```powershell
# 1. Stop immediately (Ctrl+C)

# 2. Check log file
notepad $env:TEMP\DevOptimizer_*.log | Select-Object -Last 1

# 3. System restore (if needed)
Start-Process rstrui.exe

# 4. Check Recycle Bin
explorer shell:RecycleBinFolder

# 5. Verify critical tools
git status
node --version
code --version
```

## ✅ Verification Commands (Post-Run)

### System Health Check:
```powershell
# Test Git
git status

# Test Node.js
node --version

# Test VSCode
code --version

# Test Browser Access
Start-Process "msedge.exe"

# Check Disk Space
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Free(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
```

## 🎯 Final Safety Recommendation

**For 99% of users:**
```powershell
# Start here - zero risk
.\DevOptimizer_Final_Fixed.ps1 -Mode Test -TestMode
```

**For advanced users:**
```powershell
# Progress through these sequentially
.\DevOptimizer_Final_Fixed.ps1 -Mode Test -TestMode
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe -DryRun  
.\DevOptimizer_Final_Fixed.ps1 -Mode Safe
```

**For experts only:**
```powershell
# Only after extensive testing
.\DevOptimizer_Final_Fixed.ps1 -Mode Dev -DryRun
.\DevOptimizer_Final_Fixed.ps1 -Mode Dev
```

---

**Remember**: The safest approach is always Test Mode → Dry Run → Safe execution. Skip steps at your own risk.
