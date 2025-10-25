# UI Development with Hot Reload

## Overview

The `docker-compose.debug.yml` now includes a `ui-builder` service that automatically rebuilds the UI when you make changes to the frontend code.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   ui-builder    │────────▶│  event-player    │
│  (Node Alpine)  │         │   (Python API)   │
│                 │         │                  │
│  - Watches UI   │         │  - Serves API    │
│  - Rebuilds CSS │         │  - Serves Static │
│  - Rebuilds JS  │         │  - Hot Reload    │
│  - HMR on :1234 │         │    on :8884      │
└─────────────────┘         └──────────────────┘
         │                           │
         └──────── shared ───────────┘
              ./static volume
```

## Services

### ui-builder

- **Image**: `node:20-alpine`
- **Purpose**: Watches and rebuilds UI assets on change
- **Port**: `1234` (Parcel HMR - Hot Module Replacement)
- **Command**: `npm run dev`
- **Features**:
  - Automatic `npm install` on startup
  - Watches `src/ui/` for changes
  - Rebuilds to `static/` directory
  - Hot reload via Parcel HMR

### event-player

- **Purpose**: FastAPI backend + serves static UI
- **Port**: `8884` (API and UI)
- **Port**: `5675` (Python debugger)
- **Dependencies**: Waits for `ui-builder` to be ready
- **Features**:
  - API hot reload via Uvicorn `--reload`
  - Serves UI from shared `static/` volume

## Usage

### Start Development Environment

```bash
# Start both services
docker-compose -f docker-compose.debug.yml up -d

# Watch logs
docker-compose -f docker-compose.debug.yml logs -f

# Watch ui-builder only
docker-compose -f docker-compose.debug.yml logs -f ui-builder
```

### Making UI Changes

1. **Edit any file in `src/ui/`**:

   - JavaScript: `src/ui/js/**/*.js`
   - SCSS: `src/ui/scss/**/*.scss`
   - HTML: `src/ui/html/**/*.html`
   - Images: `src/ui/img/**/*`

2. **ui-builder automatically**:

   - Detects the change
   - Rebuilds assets to `static/`
   - Triggers hot reload in browser

3. **Refresh browser** (or wait for HMR):
   - Navigate to `http://localhost:8884`
   - Changes appear immediately

### Rebuild from Scratch

```bash
# Stop services
docker-compose -f docker-compose.debug.yml down

# Clean node_modules (optional)
docker volume rm cloudevent-player_node_modules 2>/dev/null || true

# Start fresh
docker-compose -f docker-compose.debug.yml up --build -d
```

## Volumes

### Bind Mounts

- `.:/app` - Full project directory (ui-builder)
- `./src:/app/src` - Python source (event-player)
- `./static:/app/static` - **Shared** built UI assets

### Anonymous Volumes

- `/app/node_modules` - Prevents overwriting container's node_modules with host

## Development Workflow

### Typical Session

```bash
# 1. Start services
docker-compose -f docker-compose.debug.yml up -d

# 2. Open browser
open http://localhost:8884

# 3. Edit UI files in your IDE
code src/ui/js/sse/events.js

# 4. Watch logs (optional)
docker-compose -f docker-compose.debug.yml logs -f ui-builder

# 5. See changes automatically in browser

# 6. When done
docker-compose -f docker-compose.debug.yml down
```

### Frontend Development Only

If you only need to work on the UI:

```bash
# Start ui-builder only
docker-compose -f docker-compose.debug.yml up ui-builder

# Or run locally without Docker
npm install
npm run dev
# UI available at http://localhost:1234
```

## NPM Scripts

### Available Commands

```json
{
  "start": "npm run copy && parcel serve ...",
  "dev": "npm run copy && parcel serve ... --hmr-port 1234",
  "build": "npm run copy && parcel build ...",
  "copy": "copyfiles -f src/ui/img/*.* static/img"
}
```

- **`npm run dev`**: Development mode with HMR (used by ui-builder)
- **`npm run build`**: Production build (used in Dockerfile)
- **`npm start`**: Development mode without HMR port
- **`npm run copy`**: Copy images to static folder

## Ports

| Port | Service      | Purpose                             |
| ---- | ------------ | ----------------------------------- |
| 8884 | event-player | API + UI (main access)              |
| 5675 | event-player | Python debugger (debugpy)           |
| 1234 | ui-builder   | Parcel HMR (optional direct access) |

## Troubleshooting

### UI not updating

```bash
# Check if ui-builder is running
docker-compose -f docker-compose.debug.yml ps ui-builder

# Check ui-builder logs
docker-compose -f docker-compose.debug.yml logs ui-builder

# Rebuild everything
docker-compose -f docker-compose.debug.yml restart ui-builder
```

### Parcel build errors

```bash
# Clean and rebuild
docker-compose -f docker-compose.debug.yml down
docker volume rm cloudevent-player_node_modules 2>/dev/null || true
docker-compose -f docker-compose.debug.yml up --build ui-builder
```

### Static files not served

```bash
# Check static volume mount
docker-compose -f docker-compose.debug.yml exec event-player ls -la /app/static

# Check if files exist
docker-compose -f docker-compose.debug.yml exec ui-builder ls -la /app/static
```

### Permission issues

```bash
# Fix ownership (macOS/Linux)
sudo chown -R $USER:$USER static/

# Or rebuild with fresh volumes
docker-compose -f docker-compose.debug.yml down -v
docker-compose -f docker-compose.debug.yml up -d
```

## Performance Tips

### Faster Rebuilds

1. **Limit watched files**: Parcel automatically watches only relevant files
2. **Use .gitignore**: Parcel respects .gitignore for watch exclusions
3. **SSD recommended**: Fast disk I/O helps with file watching

### Production Build

For production, the main Dockerfile uses `npm run build`:

```dockerfile
# Dockerfile (excerpt)
FROM node:16-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ui/ ./src/ui/
RUN npm run build  # Production build, no HMR
```

## Best Practices

1. **Always use docker-compose for development**: Ensures consistent environment
2. **Don't commit `static/` files**: They're generated from `src/ui/`
3. **Use `npm run dev` for development**: Enables HMR and faster rebuilds
4. **Use `npm run build` for production**: Optimized, minified assets
5. **Check ui-builder logs if changes don't appear**: May show build errors

## Related Documentation

- [Parcel Documentation](https://parceljs.org/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Hot Module Replacement](https://parceljs.org/features/hmr/)
