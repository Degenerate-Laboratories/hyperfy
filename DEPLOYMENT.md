# Hyperfy Playground Deployment Guide

This guide covers automated deployment workflows for the Hyperfy Playground using GitHub Actions.

## Available Workflows

### 1. GitHub Container Registry (GHCR) - `docker.yml`

**Triggers:**
- Push to: `main`, `dev`, `solana-v2`, `ai` branches
- Tags matching: `v*.*.*`
- Pull requests to: `main`, `dev`
- Manual dispatch

**Features:**
- Multi-platform builds (linux/amd64, linux/arm64)
- Automated versioning from package.json
- GitHub Actions cache for faster builds
- PR validation (build-only, no push)
- Deployment summaries with pull/run instructions

**Image Location:**
```
ghcr.io/degenerate-laboratories/hyperfy
```

**Available Tags:**
- `main` - Latest stable build from main branch
- `dev` - Latest development build
- `v1.2.3` - Semantic version tags
- `dev-20260118-<sha>` - Timestamped branch builds
- `<branch>-<sha>` - Branch-specific commits

### 2. DigitalOcean Container Registry - `deploy-digitalocean.yml`

**Triggers:**
- Push to: `main`, `dev` branches
- Tags matching: `v*.*.*`
- Manual dispatch

**Features:**
- Optimized for DigitalOcean infrastructure
- Automatic registry login via doctl
- Garbage collection for old images
- Single platform (linux/amd64) for faster builds
- Deployment instructions in workflow summary

**Requirements:**
- `DIGITALOCEAN_TOKEN` secret configured in repository settings

**Image Location:**
```
registry.digitalocean.com/<your-registry>/hyperfy-playground
```

## Setup Instructions

### GitHub Container Registry (Default)

No additional setup required. GHCR uses the built-in `GITHUB_TOKEN` with package write permissions.

**Pull Public Images:**
```bash
docker pull ghcr.io/degenerate-laboratories/hyperfy:dev
docker run -p 3000:3000 ghcr.io/degenerate-laboratories/hyperfy:dev
```

**Pull Private Images:**
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/degenerate-laboratories/hyperfy:dev
```

### DigitalOcean Container Registry

1. **Create DigitalOcean Personal Access Token:**
   - Go to: https://cloud.digitalocean.com/account/api/tokens
   - Generate new token with read/write permissions
   - Copy the token

2. **Add Secret to GitHub Repository:**
   - Go to: Repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `DIGITALOCEAN_TOKEN`
   - Value: Your DigitalOcean token
   - Click "Add secret"

3. **Create DigitalOcean Container Registry:**
   ```bash
   doctl registry create <registry-name>
   ```

4. **Pull Images:**
   ```bash
   doctl registry login
   docker pull registry.digitalocean.com/<registry-name>/hyperfy-playground:dev
   docker run -p 3000:3000 registry.digitalocean.com/<registry-name>/hyperfy-playground:dev
   ```

## Workflow Details

### Build Process

1. **Checkout** - Fetches repository code with full history
2. **Node Setup** - Installs Node.js 22.11.0
3. **Version Extraction** - Reads version from package.json
4. **QEMU Setup** - Enables multi-platform builds (GHCR only)
5. **Buildx Setup** - Configures Docker buildx for advanced builds
6. **Registry Login** - Authenticates with container registry
7. **Metadata Generation** - Creates tags and labels
8. **Build & Push** - Builds Docker image and pushes to registry
9. **Summary Report** - Generates deployment instructions

### Build Arguments

All workflows pass these build arguments to Dockerfile:

- `COMMIT_HASH` - Git commit SHA for traceability
- `VERSION` - Semantic version from package.json

Access in Dockerfile:
```dockerfile
ARG COMMIT_HASH=local
ARG VERSION=0.0.0
ENV COMMIT_HASH=${COMMIT_HASH}
ENV VERSION=${VERSION}
```

### Caching Strategy

Both workflows use GitHub Actions cache (`type=gha`) to:
- Cache Docker layers between builds
- Reduce build time by 50-70%
- Minimize bandwidth usage

## Manual Deployment

### Trigger via GitHub UI

1. Go to: Actions → Select workflow
2. Click "Run workflow"
3. Select branch
4. Click "Run workflow" button

### Trigger via GitHub CLI

```bash
# Trigger GHCR workflow
gh workflow run docker.yml --ref dev

# Trigger DigitalOcean workflow
gh workflow run deploy-digitalocean.yml --ref main
```

## Deployment Strategies

### Development Workflow
```bash
# Push to dev branch
git push origin dev

# Workflow builds and pushes: ghcr.io/.../hyperfy:dev
# Pull and test
docker pull ghcr.io/degenerate-laboratories/hyperfy:dev
docker run -p 3000:3000 --env-file .env ghcr.io/degenerate-laboratories/hyperfy:dev
```

### Production Release
```bash
# Tag release
git tag v1.0.0
git push origin v1.0.0

# Workflow builds and pushes:
# - ghcr.io/.../hyperfy:v1.0.0
# - ghcr.io/.../hyperfy:1.0
# - ghcr.io/.../hyperfy:latest (if main branch)

# Deploy production
docker pull ghcr.io/degenerate-laboratories/hyperfy:v1.0.0
docker run -p 3000:3000 --env-file .env.production ghcr.io/degenerate-laboratories/hyperfy:v1.0.0
```

### Rollback Strategy
```bash
# List available tags
docker images ghcr.io/degenerate-laboratories/hyperfy

# Rollback to previous version
docker pull ghcr.io/degenerate-laboratories/hyperfy:v0.9.0
docker run -p 3000:3000 --env-file .env ghcr.io/degenerate-laboratories/hyperfy:v0.9.0
```

## Environment Variables

Create `.env` file for local development and production deployments:

```bash
# Copy example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

**Required for Docker deployment:**
- Configure all environment variables in `.env`
- Mount `.env` file or pass variables via `--env-file` flag
- See `.env.example` for full list of required variables

## Monitoring and Troubleshooting

### View Workflow Status

```bash
# List recent workflow runs
gh run list --workflow=docker.yml

# View specific run details
gh run view <run-id>

# View logs
gh run view <run-id> --log
```

### Common Issues

**Build fails with "permission denied":**
- Check repository has package write permissions
- Verify `GITHUB_TOKEN` has correct scopes

**DigitalOcean login fails:**
- Verify `DIGITALOCEAN_TOKEN` secret is set
- Check token has registry read/write permissions
- Ensure DigitalOcean registry exists

**Multi-platform build timeout:**
- GHCR workflow builds for amd64 and arm64
- Consider using DigitalOcean workflow (amd64 only) for faster builds

**Image pull fails:**
- Verify you're authenticated to the registry
- Check image tag exists: `docker images ghcr.io/degenerate-laboratories/hyperfy`
- For private images, ensure login before pull

### Health Check

The Dockerfile includes a health check on port 3000:

```dockerfile
HEALTHCHECK --interval=2s --timeout=10s --start-period=5s --retries=5 \
  CMD curl -f http://localhost:3000/status || exit 1
```

Check container health:
```bash
docker ps
# Look for "healthy" status in output
```

## Next Steps

- [ ] Configure `DIGITALOCEAN_TOKEN` secret for DigitalOcean deployments
- [ ] Set up production environment variables
- [ ] Test deployment with `dev` branch
- [ ] Create production release with semantic version tag
- [ ] Set up Kubernetes or Docker Compose for orchestration

## Additional Resources

- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [DigitalOcean Container Registry Documentation](https://docs.digitalocean.com/products/container-registry/)
- [Docker Build Action](https://github.com/docker/build-push-action)
- [Hyperfy Documentation](./README.md)
