# Fixing GitHub Pages Deployment

## Current Problem

GitHub Pages is set to deploy from the `main` **branch**, but we configured it to use **GitHub Actions**. This means the static files aren't being generated and deployed correctly.

## ✅ Solution: Change GitHub Pages Source to GitHub Actions

### Step-by-Step Instructions

1. **Go to Repository Settings**

   - Navigate to: <https://github.com/bvandewe/events-player/settings/pages>

2. **Change Source**

   - Under **"Build and deployment"** section
   - Find **"Source"** dropdown
   - Currently shows: `Deploy from a branch` ❌
   - **Change to**: `GitHub Actions` ✅

3. **Save and Wait**
   - The change is automatic (no Save button)
   - Wait for the workflow to trigger automatically
   - Or manually trigger: Go to **Actions** tab → **Deploy Documentation** → **Run workflow**

## Verification Steps

### 1. Check Workflow Run

- Go to: <https://github.com/bvandewe/events-player/actions>
- Look for **"Deploy Documentation"** workflow
- Should show a green checkmark ✅ when complete
- Click on the run to see details

### 2. Verify Deployment

Once the workflow completes:

- Your site will be live at: **<https://bvandewe.github.io/events-player/>**
- Click the URL in the workflow summary to verify

### 3. Check Pages Settings

Return to Settings > Pages and you should see:

```
✅ Your site is live at https://bvandewe.github.io/events-player/
```

## Current Workflow Status

The workflow file (`.github/workflows/deploy-docs.yml`) is correctly configured:

✅ Triggers on push to `main` branch
✅ Has correct permissions (`pages: write`)
✅ Builds documentation with MkDocs
✅ Uploads artifact for GitHub Pages
✅ Deploys to GitHub Pages

**The only issue is the repository setting!**

## Manual Workflow Trigger

If you want to trigger the deployment immediately after changing the setting:

1. Go to **Actions** tab: <https://github.com/bvandewe/events-player/actions>
2. Click **Deploy Documentation** workflow (left sidebar)
3. Click **Run workflow** button (right side)
4. Select `main` branch
5. Click **Run workflow**

## Troubleshooting

### If workflow fails with "pages build and deployment" error

This usually means GitHub Pages isn't configured for Actions:

```
Error: Resource not accessible by integration
```

**Fix**: Make sure you changed Source to "GitHub Actions" (see step 2 above)

### If workflow succeeds but site shows 404

1. Check the site URL matches: `https://bvandewe.github.io/events-player/`
2. Wait 2-3 minutes after deployment
3. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
4. Check `mkdocs.yml` has correct `site_url`:

   ```yaml
   site_url: https://bvandewe.github.io/events-player/
   ```

### If you see "There isn't a GitHub Pages site here"

1. Verify Pages is enabled in Settings > Pages
2. Check that the workflow completed successfully
3. Verify the deployment environment was created:
   - Go to Settings > Environments
   - Should see `github-pages` environment

## Expected Workflow Output

When successful, you should see in the Actions logs:

```
Run actions/deploy-pages@v4
Deploying to GitHub Pages...
Creating Pages deployment with payload: {
  ...
}
Created deployment for <commit-sha>
Deployment is live at: https://bvandewe.github.io/events-player/
```

## Compare Settings

### ❌ Wrong (Current)

```
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

### ✅ Correct (Target)

```
Source: GitHub Actions
```

## Additional Notes

- **First deployment** may take 2-3 minutes
- **Subsequent deployments** are usually faster (30-60 seconds)
- The workflow automatically runs when you push to `main`
- You can also manually trigger deployments anytime

## Quick Command to Trigger

After changing the setting, you can trigger with:

```bash
git commit --allow-empty -m "Trigger Pages deployment"
git push github main
```

Or just wait for your next regular push to `main`.

## References

- [GitHub Pages Documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Deploy Pages Action](https://github.com/actions/deploy-pages)
- [GitHub Actions for Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
