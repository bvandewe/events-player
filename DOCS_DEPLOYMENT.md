# Documentation Deployment Guide

This project uses MkDocs with Material theme for documentation, deployed to both GitHub Pages and GitLab Pages.

## 📚 Documentation Sites

- **GitHub Pages**: https://bvandewe.github.io/events-player/
- **GitLab Pages**: https://mozart.pages.ccie.cisco.com/infrastructure/eventing/cloudevent-player/ (or your GitLab Pages URL)

## 🚀 Automatic Deployment

Documentation is automatically built and deployed when:

### GitHub Pages
- Push to `main` branch
- Create a new tag (e.g., `v0.2.0`)
- Manual workflow dispatch

The deployment workflow is defined in `.github/workflows/deploy-docs.yml`.

### GitLab Pages
- Push to the default branch (`main`)
- Create a new tag

The deployment job is defined in `.gitlab-ci.yml` under the `pages` job.

## 🛠️ Local Development

### Prerequisites
```bash
pip install mkdocs mkdocs-material pymdown-extensions
```

### Serve locally
```bash
mkdocs serve
```

The documentation will be available at http://127.0.0.1:8884

### Build locally
```bash
mkdocs build --clean
```

The built site will be in the `site/` directory.

## 📝 Documentation Structure

```
docs/
├── index.md              # Homepage
├── changelog.md          # Change history
├── quick-start.md        # Quick start guide
├── installation.md       # Installation instructions
├── usage.md              # Usage guide
├── configuration.md      # Configuration reference
├── deployment.md         # Deployment guide
└── assets/
    ├── css/              # Custom CSS
    ├── js/               # Custom JavaScript
    └── images/           # Images and GIFs
```

## 🎨 Theme Configuration

The documentation uses:
- **Material for MkDocs** theme
- **Color scheme**: Black, white, and teal accent
- **Font**: Montserrat
- **Features**: Search, navigation tabs, table of contents, code highlighting

## 🔧 Customization

To customize the documentation:

1. Edit content in `docs/` directory
2. Modify theme settings in `mkdocs.yml`
3. Add custom CSS in `docs/assets/css/custom.css`
4. Add custom JavaScript in `docs/assets/js/`

## 📦 GitHub Pages Setup

To enable GitHub Pages deployment:

1. Go to your repository settings
2. Navigate to **Pages** section
3. Under **Source**, select "GitHub Actions"
4. The workflow will automatically deploy on the next push

## 📦 GitLab Pages Setup

GitLab Pages is automatically enabled when:
- The `pages` job runs successfully
- It creates a `public/` artifact directory

Access settings:
1. Go to **Settings** > **Pages** in your GitLab project
2. View the deployed site URL
3. Configure access level (public/private)

## 🔍 Troubleshooting

### GitHub Pages not updating
- Check the "Actions" tab for workflow runs
- Ensure GitHub Pages is set to "GitHub Actions" as source
- Verify the workflow has write permissions

### GitLab Pages not updating
- Check the CI/CD pipeline status
- Verify the `pages` job completed successfully
- Check that the `public/` artifact was created

### Build errors
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check for broken links in documentation
- Validate YAML syntax in `mkdocs.yml`

## 📚 Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- [GitHub Pages](https://docs.github.com/en/pages)
- [GitLab Pages](https://docs.gitlab.com/ee/user/project/pages/)
