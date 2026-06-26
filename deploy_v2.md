# MagSnap Deploy V2

## Goal

Keep `https://magsnap.me` as the permanent QR-code entry while preserving GitHub Pages as the overseas primary site.

Aliyun OSS + CDN is used only for a China optimized mirror at `https://cn.magsnap.me`. This PR does not replace GitHub Pages, does not create a new form backend, and does not create Singapore OSS or Function Compute resources.

Target domains:

```text
magsnap.me        Permanent QR-code entry and global main domain
www.magsnap.me    Global main-domain alias
cn.magsnap.me     China optimized mirror, not a user-entered replacement URL
```

## Architecture

```text
GitHub repository: MagsnapMZ/magsnap
  -> GitHub Pages remains the overseas primary static host
  -> GitHub Actions can build the same static files for the China mirror
  -> Aliyun OSS stores mirror files only
  -> Aliyun CDN serves cn.magsnap.me only
  -> DNS or edge routing is evaluated separately for the single QR-code entry
```

The printed-card QR code already points to `magsnap.me`, so `cn.magsnap.me` must not become the required public entry. It is a mirror target for routing and fallback.

## Repository Files

- `.github/workflows/deploy-aliyun.yml`
  - Manual China mirror deployment workflow.
  - Defaults verification to `https://cn.magsnap.me`.
  - Blocks non-dry-run deploys if `ALIYUN_CDN_DOMAIN` is `magsnap.me` or `www.magsnap.me`.
- `scripts/deploy/prepare_static_site.py`
  - Builds `dist/` from static repo files.
- `scripts/deploy/verify_static_site.py`
  - Verifies SEO files, metadata, internal links, and China render-blocking dependencies.
- `scripts/deploy/deploy_to_aliyun.py`
  - Uploads files to OSS with cache metadata.
  - Uploads both current mirror files and `__releases/<git_sha>/` snapshots.
- `scripts/deploy/rollback_aliyun.py`
  - Restores a prior `__releases/<git_sha>/` snapshot to the mirror root.
- `scripts/deploy/refresh_cdn.py`
  - Calls Aliyun CDN refresh for the mirror CDN domain.
- `scripts/deploy/verify_deployment.py`
  - Verifies live mirror routes after deployment.
- `deployment_qr_entry_routing_recommendation.md`
  - Routing options for keeping `magsnap.me` as one QR-code entry while serving China and overseas users through different origins.

## Out Of Scope For This PR

Do not build these in PR #2:

- Singapore OSS
- Function Compute
- `api.magsnap.me`
- `media.magsnap.me`
- New form backend
- New private media storage
- Business page design changes

Current form submission and image handling should stay as-is unless real China or overseas submission failures are confirmed.

## GitHub Secrets For China Mirror

Create these in GitHub:

`Settings -> Secrets and variables -> Actions -> Secrets`

Required:

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_REGION`
- `ALIYUN_OSS_BUCKET`
- `ALIYUN_OSS_ENDPOINT`
- `ALIYUN_CDN_DOMAIN`

Recommended China mirror values:

```text
ALIYUN_REGION=cn-hangzhou
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
ALIYUN_CDN_DOMAIN=cn.magsnap.me
```

The mirror workflow must not use:

```text
ALIYUN_CDN_DOMAIN=magsnap.me
ALIYUN_CDN_DOMAIN=www.magsnap.me
```

Use a least-privilege RAM user. Required permissions:

- OSS put/list/copy object for the China mirror static bucket
- CDN `RefreshObjectCaches` for `cn.magsnap.me`

## GitHub Variables

Create these in:

`Settings -> Secrets and variables -> Actions -> Variables`

Optional:

- `SITE_BASE_URL`
  - Default: `https://cn.magsnap.me`
- `DEPLOY_VERIFY_BASE_URL`
  - Default: same as `SITE_BASE_URL`
  - During pre-cutover testing, set this to the Aliyun CDN temporary/test domain.
- `DISALLOW_SERVER_CONTAINS`
  - Default: `GitHub.com`
- `LIGHTHOUSE_MIN_SCORE`
  - Default: `0.95`
- `ALIYUN_OSS_PREFIX`
  - Optional. Leave empty for the mirror root.

## China Mirror OSS Configuration

Create one OSS bucket for the `cn.magsnap.me` static mirror.

Required settings:

- Static website hosting: enabled
- Default homepage: `index.html`
- Default 404 page: `404.html`
- Public access should be controlled by CDN/origin access policy according to Aliyun best practice.
- Keep bucket region aligned with the China mirror CDN strategy.

Upload behavior:

- HTML, `robots.txt`, `sitemap.xml`, and deployment manifest:
  - `Cache-Control: no-cache, max-age=0, must-revalidate`
- CSS, JS, JSON, web manifest:
  - `Cache-Control: public, max-age=600, must-revalidate`
- Images, video, SVG, icon, font-like assets:
  - `Cache-Control: public, max-age=2592000`

## China Mirror CDN Configuration

Create CDN acceleration for:

```text
cn.magsnap.me
```

Required CDN settings:

- Origin: OSS bucket website endpoint or OSS origin configured through Aliyun CDN
- HTTPS: enabled with valid certificate for `cn.magsnap.me`
- HTTP/2: enabled
- Compression: gzip enabled
- Brotli: enabled if available
- Cache rules:
  - `*.html`: no-cache or very short TTL
  - `/robots.txt`: no-cache or short TTL
  - `/sitemap.xml`: no-cache or short TTL
  - `*.css`, `*.js`: short TTL unless filenames become hashed
  - images/videos/assets: long TTL
- Directory index behavior must support:
  - `/panda-masters/`
  - `/most-wanted/`
  - `/registry/`
  - `/founder/`

## DNS Policy

Do not use the Aliyun mirror workflow to move the printed-card entry domain.

Desired DNS roles:

```text
@      QR-code entry; overseas should continue to use GitHub Pages unless routing tests prove otherwise
www    GitHub Pages alias or same routing policy as apex
cn     Aliyun China optimized mirror
```

`magsnap.me` must remain valid globally and in China because printed cards already depend on it.

## Routing Evaluation

The next decision is whether `magsnap.me` can safely use region-aware routing:

```text
China visitors    -> Aliyun OSS/CDN mirror
Overseas visitors -> GitHub Pages
```

Evaluate this on a test hostname first, for example:

```text
qr-test.magsnap.me
```

Do not apply regional routing to `magsnap.me` until the test hostname is verified from:

- Mainland China mobile network
- WeChat in mainland China
- Vietnam mobile network
- US/EU desktop or mobile network

## Deployment

The Aliyun mirror workflow is manual-only.

Manual China mirror deployment:

1. Open GitHub Actions.
2. Select `Deploy China Mirror to Aliyun OSS CDN`.
3. Run workflow.
4. Use `dry_run=true` first.
5. Use `dry_run=false` only after confirming `ALIYUN_CDN_DOMAIN=cn.magsnap.me`.

No push to `main` should automatically deploy or switch the global main site.

## Rollback

Every normal mirror deployment uploads a release snapshot:

```text
oss://<bucket>/__releases/<git_sha>/
```

Rollback:

1. Open GitHub Actions.
2. Select `Deploy China Mirror to Aliyun OSS CDN`.
3. Run workflow manually.
4. Set `rollback_release` to the previous Git SHA.
5. Leave `dry_run=false`.

The rollback copies the snapshot from `__releases/<git_sha>/` back to the mirror root and refreshes `cn.magsnap.me`.

## Verification

Pre-deploy static checks:

- Required files:
  - `index.html`
  - `404.html`
  - `robots.txt`
  - `sitemap.xml`
  - `favicon.svg`
  - `site.webmanifest`
- Homepage canonical
- Homepage Open Graph
- Favicon
- Manifest
- Internal file references
- China render-blocking external hosts

Post-deploy mirror checks:

- `https://cn.magsnap.me/`
- `https://cn.magsnap.me/404.html`
- `https://cn.magsnap.me/robots.txt`
- `https://cn.magsnap.me/sitemap.xml`
- `https://cn.magsnap.me/site.webmanifest`
- `https://cn.magsnap.me/favicon.svg`
- `https://cn.magsnap.me/panda-masters/`
- `https://cn.magsnap.me/most-wanted/`
- `https://cn.magsnap.me/registry/`
- Mobile user-agent fetch
- Desktop user-agent fetch

Routing checks before changing `magsnap.me`:

- China resolver returns the China mirror target on the test hostname.
- Overseas resolver returns the GitHub Pages target on the test hostname.
- Both targets serve the same content version.
- TLS is valid for both origins.
- WeChat opens the QR entry without manual domain switching.

## China Compatibility

Current render-critical external dependency status:

- No Google Fonts
- No gstatic render dependency
- No YouTube embeds
- No Google Analytics render dependency

Current known non-render risk:

- Google Apps Script can be unreliable from mainland China for form submissions.
- Keep it for now unless real submission failures are confirmed.
- Treat form/backend migration as a separate later PR if needed.

Recommendation:

- Keep GitHub Pages as the overseas primary host.
- Use Aliyun OSS + CDN for `cn.magsnap.me` as the China optimized mirror.
- Evaluate DNS-level regional routing for `magsnap.me` on a test hostname before applying it to the printed QR domain.
- Do not deploy new API or media storage in this PR.

## Maintenance

- Review `china_compatibility_report.md` after major frontend or form changes.
- Review Lighthouse artifacts after each mirror deployment.
- Rotate Aliyun RAM credentials regularly.
- Keep OSS release snapshots for a defined retention window.
- Test `magsnap.me`, `cn.magsnap.me`, and the routing test hostname from China and overseas before production changes.

## Troubleshooting

Missing secrets:

- Workflow fails at `Validate Aliyun configuration`.
- Add required GitHub Secrets.

OSS upload fails:

- Check `ALIYUN_OSS_ENDPOINT`.
- Check bucket name.
- Check RAM permissions.
- Check whether the upload tool can access the region.

CDN refresh fails:

- Check `ALIYUN_CDN_DOMAIN`.
- Confirm it is `cn.magsnap.me`, not `magsnap.me`.
- Check CDN permissions for the RAM user.
- Confirm CDN domain exists and is enabled.

Directory pages return 404:

- Confirm OSS static website hosting is enabled.
- Confirm CDN origin uses website endpoint behavior or equivalent rewrite behavior.
- Confirm `/path/index.html` files exist in OSS.
