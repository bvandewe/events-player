# Fixing GitHub Container Registry (ghcr.io) Permissions

## Problem

```
ERROR: failed to push ghcr.io/bvandewe/events-player:main: denied: permission_denied: write_package
```

This error occurs when the GitHub Actions workflow doesn't have permission to push to the GitHub Container Registry.

## Solutions

### 1. Enable GitHub Actions Write Permission (Recommended)

1. Go to your GitHub repository: <https://github.com/bvandewe/events-player>
2. Navigate to **Settings** > **Actions** > **General**
3. Scroll to **Workflow permissions**
4. Select **"Read and write permissions"**
5. Check the box: **"Allow GitHub Actions to create and approve pull requests"**
6. Click **Save**

### 2. Verify Package Permissions

After the first successful build, ensure the package has proper permissions:

1. Go to <https://github.com/bvandewe/events-player/pkgs/container/events-player>
2. Click **Package settings**
3. Under **Manage Actions access**, verify that the repository has write access
4. Add the repository if not present: `bvandewe/events-player` with **Write** role

### 3. Link Package to Repository

1. Go to the package page (after first push): <https://github.com/users/bvandewe/packages/container/events-player>
2. Click **Connect repository**
3. Select `bvandewe/events-player`
4. This allows the package to inherit repository permissions

### 4. Check Workflow Configuration

The workflow already has the correct permissions:

```yaml
permissions:
  contents: read
  packages: write # ← This allows pushing to ghcr.io
  id-token: write
```

If you see the error, it's typically a **repository settings** issue, not a workflow issue.

## Verification

After applying the fix, trigger a new build:

```bash
# Trigger workflow manually
git commit --allow-empty -m "Trigger workflow"
git push github main

# Or push a new tag
git tag -a v0.2.1 -m "Test GHCR permissions"
git push github v0.2.1
```

Check the Actions tab to verify the build succeeds.

## Expected Result

You should see:

```
#23 pushing layers
#23 pushing layers 5.2s done
#23 pushing manifest for ghcr.io/bvandewe/events-player:main@sha256:...
#23 pushing manifest for ghcr.io/bvandewe/events-player:main@sha256:... 1.3s done
#23 DONE 6.6s
```

## Additional Steps

### Make Package Public (Optional)

1. Go to <https://github.com/bvandewe/events-player/pkgs/container/events-player>
2. Click **Package settings**
3. Scroll to **Danger Zone**
4. Click **Change visibility**
5. Select **Public**
6. Confirm the change

This allows anyone to pull the image without authentication:

```bash
docker pull ghcr.io/bvandewe/events-player:latest
```

### Using Personal Access Token (Alternative)

If workflow permissions don't work, create a PAT:

1. Go to <https://github.com/settings/tokens>
2. Click **Generate new token** > **Generate new token (classic)**
3. Select scopes:
   - `write:packages`
   - `read:packages`
   - `delete:packages`
4. Generate and copy the token
5. Add to repository secrets:
   - Go to repository **Settings** > **Secrets and variables** > **Actions**
   - Click **New repository secret**
   - Name: `GHCR_TOKEN`
   - Value: paste your PAT
6. Update workflow to use the PAT:

```yaml
- name: Log into registry ${{ env.REGISTRY }}
  if: github.event_name != 'pull_request'
  uses: docker/login-action@v3
  with:
    registry: ${{ env.REGISTRY }}
    username: ${{ github.actor }}
    password: ${{ secrets.GHCR_TOKEN }} # Changed from GITHUB_TOKEN
```

## Troubleshooting

### Check current permissions

```bash
# Check what the workflow can see
gh api /repos/bvandewe/events-player/actions/permissions
```

### Verify package exists

```bash
# List packages
gh api /users/bvandewe/packages?package_type=container
```

### Test authentication locally

```bash
# Login with PAT
echo $GHCR_TOKEN | docker login ghcr.io -u bvandewe --password-stdin

# Try pushing
docker tag your-image ghcr.io/bvandewe/events-player:test
docker push ghcr.io/bvandewe/events-player:test
```

## References

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Working with Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
