# OAuth Authentication Fix Guide

## Issues Fixed

### 1. OAuth Account Reuse (Google & Slack)
**Problem**: When users try to log in with a new Google/Slack account, they get logged into a previously used account (addaeillona@gmail.com).

**Root Causes**:
- Sessions and browser storage weren't being fully cleared before OAuth
- Google/Slack providers cache account selection
- Appwrite might reuse existing sessions

**Fixes Applied**:
- Added aggressive session clearing: `localStorage.clear()` and `sessionStorage.clear()`
- Delete ALL sessions (not just current) before OAuth: `account.deleteSessions()`
- Added 300ms delay to ensure deletions complete before redirect
- Added user ID verification after OAuth callback to detect account mismatches
- Enhanced logging to track authentication flow
- **Note**: Due to Appwrite SDK limitations, we cannot force Google's account picker programmatically. Users must manually sign out of Google if they want to switch accounts.

### 2. Manual Signup Errors
**Problem**: Email/password registration shows error toasts and fails.

**Fixes Applied**:
- Added comprehensive input validation before API calls
- Enhanced error handling with detailed logging
- Added specific error messages for common Appwrite errors
- Better password validation feedback

## Appwrite Console Configuration

### CRITICAL: Check OAuth Settings

1. **Go to your Appwrite Console** → Project: `kanban-task-management-web-app` (ID: 698b533900141667b549)

2. **Navigate to**: Auth → Settings → OAuth2 Providers

3. **For Google OAuth**:
   - ✅ Ensure "Google" provider is enabled
   - ✅ Success URL: `https://yourdomain.com/login` (or `http://localhost:5173/login` for development)
   - ✅ Failure URL: `https://yourdomain.com/login` (or `http://localhost:5173/login` for development)
   - ⚠️ **IMPORTANT**: The redirect URLs must EXACTLY match your application URLs
   - ✅ Make sure you're NOT restricting to specific Google accounts

4. **For Slack OAuth**:
   - ✅ Ensure "Slack" provider is enabled
   - ✅ Success URL: Same as Google
   - ✅ Failure URL: Same as Google
   - ✅ Verify Client ID and Client Secret are correct

5. **Session Settings**:
   - Go to Auth → Settings → Sessions
   - ✅ Session limit: Set to allow multiple sessions (or 1 if you want to force single session)
   - ✅ Session length: Default is fine (1 year)

6. **Database Permissions**:
   - Go to Databases → kanban-db
   - For `boards` collection:
     - ✅ Permissions: Ensure users can read/write their own documents
     - ✅ User-based access control should be properly configured
   - For `tasks` collection:
     - ✅ Same as boards

## Testing the Fixes

### Test 1: Google OAuth with Different Accounts

1. **Clear all application data**:
   ```bash
   # Open browser DevTools → Application → Storage → Clear site data
   ```

2. **Test first account**:
   - Click "Continue with Google"
   - Sign in with Account A (e.g., addaeillona@gmail.com)
   - Verify login works and you see Account A's email in toast
   - Check browser console for `[OAuth]` logs

3. **Test account switching**:
   - Click logout or "Sign in with a different account"
   - Click "Continue with Google"
   - **EXPECTED**: You should see Google account picker
   - Select Account B (different from Account A)
   - **VERIFY**: Toast should show Account B's email
   - **VERIFY**: Console should show Account B's user ID matches OAuth userId
   
4. **Check database**:
   - Go to Appwrite Console → Databases → kanban-db → boards
   - You should see separate boards for Account A and Account B

### Test 2: Manual Email/Password Signup

1. **Clear browser data**

2. **Test registration**:
   - Fill in Name: "Test User"
   - Fill in Email: "testuser@example.com"
   - Fill in Password: "SecurePassword123!" (at least 8 chars, not too common)
   - Click "Sign Up"
   - **VERIFY**: Success toast appears
   - **VERIFY**: You're logged in and redirected to dashboard

3. **Check console logs**:
   - Look for `[Register]` logs
   - Should see: "Creating user account..." → "User created with ID: xxx" → "Session created successfully"

4. **If errors occur**:
   - Check console for detailed error messages
   - Common issues:
     - "user_already_exists": Email is already registered
     - "password_personal_data": Password contains personal info (like name or email)
     - Network errors: Check internet connection and Appwrite endpoint

### Test 3: Slack OAuth

1. **Follow same steps as Google OAuth test**
2. Use "Continue with Slack" button
3. Verify different Slack accounts don't get mixed up

## Debugging

### Enable Verbose Logging

The fixes include comprehensive console logging. Open browser DevTools and check for:

- `[OAuth]` - OAuth flow logs
- `[Register]` - Registration logs
- `[checkSession]` - Session validation logs

### Common Issues and Solutions

#### Issue: Still logging into wrong account

**Check**:
1. Open DevTools → Console
2. Look for: `[OAuth] WARNING: User ID mismatch!`
3. If you see this, the OAuth callback is receiving wrong user ID
4. **Solution**: 
   - Clear all browser cookies for your domain
   - Sign out of Google/Slack in the browser
   - Try again with incognito/private browsing mode

#### Issue: Google doesn't show account picker

**Why this happens**: Appwrite's SDK doesn't support passing custom OAuth parameters like `prompt=select_account` to Google. Google caches your last used account.

**Solutions**:
1. **Best approach**: Sign out of Google at https://accounts.google.com/Logout before clicking "Continue with Google"
2. **Use incognito mode**: Test with a private/incognito browser window
3. **Follow the in-app warning**: After clicking "Sign in with a different account", the app shows a step-by-step guide to sign out of Google
4. **Clear browser cookies**: DevTools → Application → Cookies → Clear all for your domain

**Alternative for testing**: Use manual email/password signup which doesn't have this limitation.

#### Issue: Registration fails with "network error"

**Check**:
1. Verify Appwrite endpoint is accessible
2. Check `.env` file for correct `VITE_APPWRITE_PROJECT_ID`
3. Verify internet connection
4. Check Appwrite Console → Project Status

#### Issue: "Account mismatch detected" error

This is a **critical security error**. It means:
- OAuth returned user ID X
- But Appwrite session is for user ID Y

**Immediate action**:
1. Check Appwrite Console → Auth → Sessions
2. Manually delete all sessions for testing
3. Try OAuth flow again in incognito mode
4. If persists, contact Appwrite support - this indicates a server-side issue

## Production Deployment Checklist

Before deploying to production:

- [ ] Update OAuth redirect URLs in Appwrite Console to production domain
- [ ] Test OAuth with production URLs
- [ ] Verify SSL/HTTPS is working (required for OAuth)
- [ ] Test account switching in production environment
- [ ] Monitor error logs for authentication issues
- [ ] Consider implementing rate limiting for failed login attempts
- [ ] Add email verification for new signups (optional but recommended)

## Rollback Plan

If issues persist:

1. **Revert changes**:
   ```bash
   git checkout HEAD~1 src/services/appwriteAuth.ts
   git checkout HEAD~1 src/store/authSlice.ts
   ```

2. **Alternative approach**: Disable OAuth temporarily and use email/password only
   - Comment out OAuth buttons in `Login.tsx`
   - Focus on fixing manual signup first

3. **Contact Appwrite support**:
   - Provide project ID: `698b533900141667b549`
   - Share OAuth logs from console
   - Describe account reuse issue

## Additional Resources

- [Appwrite OAuth2 Documentation](https://appwrite.io/docs/client/account#accountCreateOAuth2Session)
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Slack OAuth Guide](https://api.slack.com/authentication/oauth-v2)

## Next Steps

1. Test all three authentication methods (Google, Slack, Email/Password)
2. Verify user isolation in database
3. Monitor console logs for any unexpected behavior
4. If all tests pass, commit changes and deploy
5. Set up monitoring/alerts for authentication failures in production
