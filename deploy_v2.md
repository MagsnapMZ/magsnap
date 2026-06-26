# MagSnap Website Deploy V2

## Goal

Move production traffic for `https://magsnap.me` from GitHub Pages to Aliyun OSS + CDN while keeping GitHub as the only source repository.

Target result:

- China-ready production hosting
- Automatic deployment from GitHub `main`
- No manual upload
- Aliyun OSS stores static files
- Aliyun CDN serves production traffic
- GitHub Pages may remain as preview, development, or backup only

## Architecture

```text
Developer / Codex
  -> Git commit
  -> GitHub repository: MagsnapMZ/magsnap
  -> GitHub Actions
  -> Prepare static package
  -> Verify static package
  -> Upload release snapshot to Aliyun OSS
  -> Upload current production files to Aliyun OSS root
  -> Refresh Aliyun CDN
  -> Verify live deployment
  -> Generate Lighthouse and compatibility reports
  -> https://magsnap.me
```

## Repository Files

- `.github/workflows/deploy-aliyun.yml`
  - Main deployment workflow.
- `scripts/deploy/prepare_static_site.py`
  - Builds `dist/` from static repo files.
- `scripts/deploy/verify_static_site.py`
  - Verifies required SEO files, metadata, internal links, and China render-blocking dependencies before upload.
- `scripts/deploy/deploy_to_aliyun.py`
  - Uploads files to OSS with cache metadata.
  - Uploads both production root files and `__releases/<git_sha>/` snapshot.
- `scripts/deploy/rollback_aliyun.py`
  - Restores a prior `__releases/<git_sha>/` snapshot to production root.
- `scripts/deploy/refresh_cdn.py`
  - Calls Aliyun CDN refresh.
- `scripts/deploy/verify_deployment.py`
  - Verifies live routes and confirms production is not still served by GitHub Pages after DNS cutover.
- `scripts/deploy/china_compatibility_report.py`
  - Generates China compatibility report.
- `scripts/deploy/performance_report.py`
  - Generates static package performance report and summarizes Lighthouse output when available.

## GitHub Secrets

Create these in GitHub:

`Settings -> Secrets and variables -> Actions -> Secrets`

Required:

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_REGION`
- `ALIYUN_OSS_BUCKET`
- `ALIYUN_OSS_ENDPOINT`
- `ALIYUN_CDN_DOMAIN`

Recommended values:

```text
ALIYUN_REGION=cn-hongkong or the selected OSS/CDN region
ALIYUN_OSS_ENDPOINT=oss-cn-hongkong.aliyuncs.com
ALIYUN_CDN_DOMAIN=magsnap.me
```

Use a least-privilege RAM user. Required permissions:

- OSS put/list/copy object for the target bucket
- CDN `RefreshObjectCaches` for the CDN domain

## GitHub Variables

Create these in:

`Settings -> Secrets and variables -> Actions -> Variables`

Optional:

- `SITE_BASE_URL`
  - Default: `https://magsnap.me`
- `DEPLOY_VERIFY_BASE_URL`
  - Default: same as `SITE_BASE_URL`
  - During pre-cutover testing, set this to the Aliyun CDN temporary/test domain.
- `DISALLOW_SERVER_CONTAINS`
  - Default: `GitHub.com`
  - After production cutover, live verification fails if response headers still show GitHub Pages.
- `LIGHTHOUSE_MIN_SCORE`
  - Default: `0.95`
- `ALIYUN_OSS_PREFIX`
  - Optional. Leave empty for production root.

## Aliyun OSS Configuration

Create one OSS bucket for production static files.

Required settings:

- Static website hosting: enabled
- Default homepage: `index.html`
- Default 404 page: `404.html`
- Public access should be controlled by CDN/origin access policy according to Aliyun best practice.
- Keep bucket region aligned with CDN strategy.

Upload behavior:

- HTML, `robots.txt`, `sitemap.xml`, and deployment manifest:
  - `Cache-Control: no-cache, max-age=0, must-revalidate`
- CSS, JS, JSON, web manifest:
  - `Cache-Control: public, max-age=600, must-revalidate`
- Images, video, SVG, icon, font-like assets:
  - `Cache-Control: public, max-age=2592000`

## Aliyun CDN Configuration

Create CDN acceleration for `magsnap.me`.

Required CDN settings:

- Origin: OSS bucket website endpoint or OSS origin configured through Aliyun CDN
- HTTPS: enabled with valid certificate for `magsnap.me`
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

## DNS Cutover

Current DNS is AliDNS / HiChina.

Before cutover:

1. Verify Aliyun OSS bucket static website works.
2. Verify Aliyun CDN test domain works.
3. Verify HTTPS certificate is active.
4. Run the GitHub Actions workflow manually with `dry_run=true`.
5. Run the GitHub Actions workflow manually with `DEPLOY_VERIFY_BASE_URL` set to the Aliyun CDN test domain.
6. Lower DNS TTL if possible.

Cutover:

1. Remove GitHub Pages A records from `magsnap.me`.
2. Point `magsnap.me` to the Aliyun CDN target according to Aliyun DNS instructions.
3. Point `www.magsnap.me` to the same CDN target or redirect it to apex.
4. Confirm `https://magsnap.me/` no longer returns `server: GitHub.com`.

## Deployment

Automatic deployment:

- Every push to `main` runs `.github/workflows/deploy-aliyun.yml`.

Manual deployment:

1. Open GitHub Actions.
2. Select `Deploy V2 to Aliyun OSS CDN`.
3. Run workflow.
4. Use `dry_run=true` for validation only.

## Rollback

Every normal deployment uploads a release snapshot:

```text
oss://<bucket>/__releases/<git_sha>/
```

Rollback:

1. Open GitHub Actions.
2. Select `Deploy V2 to Aliyun OSS CDN`.
3. Run workflow manually.
4. Set `rollback_release` to the previous Git SHA.
5. Leave `dry_run=false`.

The rollback copies the snapshot from `__releases/<git_sha>/` back to production root and refreshes CDN.

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

Post-deploy live checks:

- `/`
- `/404.html`
- `/robots.txt`
- `/sitemap.xml`
- `/site.webmanifest`
- `/favicon.svg`
- `/panda-masters/`
- `/most-wanted/`
- `/registry/`
- `/assets/founder/founder.css`
- `/assets/founder/founder.js`
- `/assets/site/panda-logo.jpg`
- Mobile user-agent fetch
- Desktop user-agent fetch
- Server header must not contain `GitHub.com` after production cutover

Lighthouse:

- Performance
- Accessibility
- Best Practices
- SEO
- Default minimum score: `95`

## China Compatibility

Current render-critical external dependency status:

- No Google Fonts
- No gstatic render dependency
- No YouTube embeds
- No Google Analytics render dependency

China-ready form submission:

- Public form submissions should use `https://api.magsnap.me/forms`.
- The API should run on Aliyun Function Compute in China and write records to private OSS.
- Panda Masters photos should be written to an OSS-backed public photo prefix and returned as an independent `photo_url`.

Recommendation:

- Use Aliyun OSS + CDN for static production immediately after testing.
- Keep Google Apps Script only as an optional back-office export/sync target.
- Do not put Google Apps Script on the China user submission path.

## Maintenance

After the first production cutover:

- Keep GitHub Pages as backup only.
- Do not point production DNS back to GitHub Pages unless rolling back hosting.
- Review `china_compatibility_report.md` after major frontend or form changes.
- Review Lighthouse artifacts after each deployment.
- Rotate Aliyun RAM credentials regularly.
- Keep OSS release snapshots for a defined retention window.

## Troubleshooting

Missing secrets:

- Workflow fails at `Validate Aliyun configuration`.
- Add required GitHub Secrets.

OSS upload fails:

- Check `ALIYUN_OSS_ENDPOINT`.
- Check bucket name.
- Check RAM permissions.
- Check whether `ossutil` can access the region.

CDN refresh fails:

- Check `ALIYUN_CDN_DOMAIN`.
- Check CDN permissions for the RAM user.
- Confirm CDN domain exists and is enabled.

Live verification still shows GitHub:

- DNS has not cut over.
- CDN domain is not mapped to `magsnap.me`.
- `DISALLOW_SERVER_CONTAINS=GitHub.com` is working correctly.

Directory pages return 404:

- Confirm OSS static website hosting is enabled.
- Confirm CDN origin uses website endpoint behavior or equivalent rewrite behavior.
- Confirm `/path/index.html` files exist in OSS.
