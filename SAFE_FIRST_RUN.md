# Safe First Run Instructions

## 🚨 CRITICAL: Read Before Running

This is a production-hardened optimization tool. **Always start with Dry Run mode** to preview exactly what will be affected.

## Step 1: Pre-Run Checklist

### ✅ System Preparation
- [ ] Save all important work in all applications
- [ ] Close critical documents and projects
- [ ] Backup important files (optional but recommended)
- [ ] Ensure you have admin access if using system cleanup features

### ✅ Browser Preparation
- [ ] Save important browser sessions/tabs
- [ ] Sync bookmarks if using cloud sync
- [ ] Note any important login sessions you want to preserve

### ✅ Development Environment
- [ ] Commit any pending git changes
- [ ] Save all IDE/editor work
- [ ] Note any running development servers you need

## Step 2: First Dry Run (REQUIRED)

```powershell
# Run in Safe mode with Dry Run to preview all actions
.\DevOptimizer_Production.ps1 -Mode Safe -DryRun
```

### What to Review in Dry Run Output:

1. **AI Cache Section**
   - Verify it's only targeting cache files, not configuration
   - Check file sizes seem reasonable
   - Confirm no personal data is being deleted

2. **Browser Cache Section**
   - Verify only cache folders are targeted
   - Confirm bookmarks, cookies, passwords are protected
   - Check browser running detection works

3. **System Cleanup Section**
   - Review temp file locations
   - Verify age requirements (7 days user temp, 3 days system)
   - Check admin privilege handling

4. **Development Processes**
   - Identify which processes would be killed
   - Verify important processes are not listed
   - Check memory usage reporting

5. **Skipped Items**
   - Review what was skipped for safety
   - Verify important folders are protected
   - Check for any unexpected protections

## Step 3: Analyze Results

### ✅ Green Light Indicators
- No errors in critical sections
- Skipped items include important folders
- Space freed amounts seem reasonable
- No unexpected processes listed for termination

### ⚠️ Warning Indicators
- Large number of errors
- Important folders not protected
- Unexpected processes in kill list
- Abnormal disk usage detected

### 🚨 Stop Indicators
- Critical system folders being targeted
- Git repositories marked for deletion
- SSH keys or credentials at risk
- Browser user data being deleted

## Step 4: First Real Run

If dry run looks safe:

```powershell
# Run in Safe mode without Dry Run
.\DevOptimizer_Production.ps1 -Mode Safe
```

### Monitor During Execution:
- Watch for any unexpected confirmations
- Review each section's output
- Check error messages
- Verify space freed amounts

## Step 5: Post-Run Verification

### ✅ System Health Check
- [ ] Browsers open and work correctly
- [ ] Development tools still functional
- [ ] Git repositories intact
- [ ] SSH keys still accessible
- [ ] Important files still present

### ✅ Performance Check
- [ ] Browser responsiveness improved
- [ ] System UI lag reduced
- [ ] Disk space freed as expected
- [ ] Startup time improved (if applicable)

## Mode Progression

### Phase 1: Safe Mode (Always start here)
- Conservative cleanup only
- No process killing
- Maximum safety protections

### Phase 2: Dev Mode (After Safe Mode works well)
- Optional process killing
- Standard cleanup levels
- Development-aware protections

### Phase 3: Aggressive Mode (Only if needed)
- Full cleanup capabilities
- Performance mode enabled
- Maximum space recovery

## Emergency Procedures

### If Something Goes Wrong:
1. **Stop the script** immediately with Ctrl+C
2. **Check the log file** for what was deleted
3. **Restore from backup** if available
4. **Restart affected applications**
5. **Run system restore** if critical issues occur

### Log File Location:
```
C:\Users\YourUsername\AppData\Local\Temp\DevOptimizer_YYYYMMDD_HHMMSS.log
```

## Common First Run Issues

### Issue: "Access Denied" Errors
**Solution**: Run PowerShell as Administrator for system cleanup features

### Issue: Browser Cache Not Cleaned
**Solution**: Close all browser windows before running

### Issue: Development Processes Still Running
**Solution**: Use Dev or Aggressive mode, or manually close before running

### Issue: "Files in Use" Errors
**Solution**: This is normal - locked files are skipped safely

## Safety Verification Commands

After running, verify these commands work:

```powershell
# Test Git access
git status

# Test SSH keys
ssh -T git@github.com

# Test Node.js
node --version

# Test browser (open Edge/Chrome)
# Should work normally with cache cleared
```

## When to Contact Support

Stop and seek help if:
- Critical development tools stop working
- Git repositories are corrupted
- SSH keys become inaccessible
- System becomes unstable
- Important user data is missing

## Final Safety Reminder

**This tool modifies your system. While extensively safety-tested, always:**
1. Start with Dry Run mode
2. Review all actions before execution
3. Have backups of critical data
4. Monitor execution closely
5. Verify system health after completion

---

**⚠️ When in doubt, run in Dry Run mode and review the output carefully!**
