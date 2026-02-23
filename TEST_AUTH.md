# Quick Test Instructions

## Start the Development Server

```bash
npm run dev
```

The app should start at `http://localhost:5173`

## Quick Test Steps

### 1. Test Manual Signup (Easiest to test first)

1. Open the app in your browser
2. Open DevTools (F12) and go to Console tab
3. Clear browser data: DevTools → Application → Storage → "Clear site data"
4. On login page, click "Don't have an account? Sign up"
5. Fill in:
   - Name: "New Test User"
   - Email: "newtestuser@example.com"
   - Password: "MySecurePass123!"
6. Click "Sign Up"
7. **Watch the Console for logs starting with `[Register]`**
8. If successful, you should:
   - See success toast
   - Be redirected to dashboard
   - See logs: "User created with ID: xxx" → "Session created successfully"

**If it fails**: Check the console error logs for details. Common issues:
- Email already exists (try a different email)
- Password too weak (use at least 8 chars, mix of letters/numbers)
- Network error (check Appwrite console is accessible)

### 2. Test Google OAuth (Critical Fix)

1. **Clear everything first**:
   - DevTools → Application → Storage → "Clear site data"
   - (Optional but recommended) Sign out of Google: https://accounts.google.com/Logout

2. Click "Continue with Google"
3. Sign in with your FIRST Google account (e.g., addaeillona@gmail.com)
4. You should be logged in successfully
5. **Check the success toast** - it should show: "Signed in as [your-email]"
6. **Check Console logs** - look for `[OAuth]` messages

7. Now test account switching:
   - Click logout or "Sign in with a different account"
   - **IMPORTANT**: Before clicking "Continue with Google", follow the in-app instructions to sign out of Google
   - Or manually go to: https://accounts.google.com/Logout (in a new tab)
   - Return and click "Continue with Google" again
   - **EXPECTED**: Google will ask you to sign in (since you signed out)
   - Sign in with a DIFFERENT Google account
   - **Verify**: Toast shows the NEW account's email (not addaeillona@gmail.com)
   - **Check Console**: Look for any `[OAuth] WARNING: User ID mismatch!` messages
   
   **Note**: Due to Appwrite SDK limitations, we cannot force Google to show the account picker. You must manually sign out of Google to switch accounts.

### 3. Test Slack OAuth

Same steps as Google OAuth, but with Slack accounts.

## What to Look For

### Console Logs to Monitor

Open browser DevTools → Console and filter by:
- `[OAuth]` - OAuth authentication flow
- `[Register]` - User registration
- `[checkSession]` - Session validation

### Success Indicators

✅ **Manual Signup**:
```
[Register] Starting registration for: newtestuser@example.com
[Register] Creating user account...
[Register] User created with ID: 67xxxxxxxxxxxxx
[Register] Creating email/password session...
[Register] Session created successfully
```

✅ **Google OAuth**:
```
[checkSession] OAuth params found — userId: 67xxxxxxxxxxxxx
[OAuth] Received callback — userId: 67xxxxxxxxxxxxx
[OAuth] All sessions deleted before creating new session
[OAuth] Session created — account.get() returned: your-email@gmail.com
[checkSession] OAuth resolved — user: { id: '67xxx', email: 'your-email@gmail.com', name: 'Your Name' }
```

✅ **Toast Message**: "Signed in as your-email@gmail.com" (should show for 5 seconds)

### Error Indicators

❌ **Wrong account logged in**:
```
[OAuth] WARNING: User ID mismatch!
Expected: 67xxxxxxxxxxxxx
Got: 67yyyyyyyyyyyyyy
```
This means the OAuth is still reusing old accounts - see OAUTH_FIX_GUIDE.md

❌ **Registration failed**:
```
[Register] Registration error: <error message>
[Register] Error details: { message: '...', code: xxx, type: '...' }
```
Check the error details for specific issues

## Appwrite Console Check

While testing, open Appwrite Console in another tab:

1. Go to: https://cloud.appwrite.io/console/project/698b533900141667b549
2. Navigate to: Auth → Users
3. After each successful signup/OAuth:
   - Refresh the users list
   - Verify the NEW user appears
   - Check the email/name matches what you used

## Troubleshooting

### Issue: OAuth shows "Authentication failed" toast

**Fix**:
1. Check Appwrite Console → Auth → Settings → OAuth2 Providers
2. Verify Google/Slack providers are enabled
3. Check redirect URLs match: `http://localhost:5173/login`

### Issue: Manual signup shows "Failed to create account"

**Fix**:
1. Try a different email (might already exist)
2. Use a stronger password (at least 8 chars, not common words)
3. Check Appwrite endpoint is accessible
4. Look at console error logs for specific error type

### Issue: Still logging into wrong Google account

**Fix**:
1. Close all browser tabs
2. Open incognito/private window
3. Go to: https://accounts.google.com/Logout
4. Close incognito window
5. Open new incognito window and test OAuth

### Issue: Can't switch Google accounts

This is expected behavior due to Appwrite SDK limitations - Google caches your account selection.

**Fix** (you MUST sign out of Google to switch accounts):
1. The app includes a warning box after logout with step-by-step instructions
2. Click the link to sign out of Google: https://accounts.google.com/Logout
3. Return to the app and click "Continue with Google"
4. Google will ask you to sign in again (you can then choose a different account)

**Alternative**: Use incognito/private browsing mode to test with different Google accounts without signing out.

## Next Steps After Testing

1. If all tests pass ✅:
   - Review the changes in `src/services/appwriteAuth.ts` and `src/store/authSlice.ts`
   - Read the full guide: `OAUTH_FIX_GUIDE.md`
   - Commit the changes
   - Deploy to production (remember to update OAuth URLs in Appwrite Console)

2. If tests fail ❌:
   - Check console logs and identify the specific error
   - Refer to OAUTH_FIX_GUIDE.md for detailed troubleshooting
   - Share console logs for further assistance

## Development Server Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run linter
npm run lint
```

## Important Files Changed

- `src/services/appwriteAuth.ts` - Main authentication logic
- `src/store/authSlice.ts` - State management and session checking
- `OAUTH_FIX_GUIDE.md` - Comprehensive guide and troubleshooting

## Support

If issues persist after following all steps:
1. Check `OAUTH_FIX_GUIDE.md` for detailed troubleshooting
2. Verify Appwrite Console configuration
3. Test in incognito mode to rule out browser cache issues
4. Share console logs for debugging assistance
