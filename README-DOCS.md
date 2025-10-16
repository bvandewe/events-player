# Documentation Deployment

This project uses MkDocs with Material theme for documentation, automatically deployed to both GitHub Pages and GitLab Pages.

## 📚 Documentation Sites

- **GitHub Pages**: <https://bvandewe.github.io/events-player/>
- **GitLab Pages**: Check your GitLab project Settings > Pages for the URL

## 🚀 Automatic Deployment

Documentation is automatically built and deployed when:

### GitHub Pages

- Push to `main` branch
- Create a new tag (e.g., `v0.2.0`)
- Manual workflow dispatch (Actions tab)

### GitLab Pages

- Push to the default branch (`main`)
- Create a new tag

## 📋 Prerequisites

All dependencies are listed in `docs-requirements.txt`:

```bash
pip install -r docs-requirements.txt
```

Or install individually:

```bash
pip install mkdocs mkdocs-material pymdown-extensions
pip install mkdocs-awesome-pages-plugin
pip install mkdocs-git-revision-date-localized-plugin
pip install mike
```

## 🛠️ Local Development

### Serve locally (with auto-reload)

```bash
mkdocs serve
```

Access at: <http://127.0.0.1:8884>

### Build locally

```bash
mkdocs build --clean --verbose
```

Output in `site/` directory

## 📦 GitHub Pages Setup

⚠️ **CRITICAL**: Change Source to "GitHub Actions" (not branch deployment!)

### One-Time Setup

1. Go to **Settings** > **Pages** in your GitHub repository
2. Under **Source**, select **"GitHub Actions"** (NOT "Deploy from a branch")
3. Push to `main` branch or trigger workflow manually
4. Check **Actions** tab for deployment status

**Current Issue**: If set to "Deploy from a branch", the documentation won't build.
See `GITHUB_PAGES_FIX.md` for detailed instructions.

## 📦 GitLab Pages Setup

GitLab Pages deploys automatically via the `pages` job in `.gitlab-ci.yml`:

1. Check **CI/CD** > **Pipelines** for job status
2. Go to **Settings** > **Pages** to view your docs URL
3. Configure access level (public/private) if needed

## 🔧 Configuration Files

- **mkdocs.yml** - MkDocs configuration
- **docs-requirements.txt** - Python dependencies
- **.github/workflows/deploy-docs.yml** - GitHub Actions workflow
- **.gitlab-ci.yml** - GitLab CI/CD (includes `pages` job)

## 🎨 Customization

- **Content**: Edit Markdown files in `docs/`
- **Theme**: Modify settings in `mkdocs.yml`
- **Styling**: Custom CSS in `docs/assets/css/custom.css`
- **Scripts**: Custom JS in `docs/assets/js/`

## 🔍 Troubleshooting

### GitHub Actions failing

1. Check the **Actions** tab for error logs
2. Verify all dependencies in `docs-requirements.txt` are compatible
3. Ensure GitHub Pages is set to "GitHub Actions" as source
4. Check workflow has proper permissions (pages: write, id-token: write)

### GitLab Pages not deploying

1. Check **CI/CD** > **Pipelines** for the `pages` job status
2. Verify the job creates a `public/` directory
3. Check that `docs-requirements.txt` is present
4. Review job logs for build errors

### Build errors locally

1. Update dependencies: `pip install -r docs-requirements.txt --upgrade`
2. Clear cache: `rm -rf site/`
3. Rebuild: `mkdocs build --clean --verbose`
4. Check for broken links or missing pages

### Missing plugins error

If you see errors about missing plugins, ensure all dependencies are installed:

```bash
pip install -r docs-requirements.txt
```

## 📚 Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- [GitHub Pages](https://docs.github.com/en/pages)
- [GitLab Pages](https://docs.gitlab.com/ee/user/project/pages/)
