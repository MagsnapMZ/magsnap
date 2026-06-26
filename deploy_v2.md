# MagSnap Deploy V2

## Goal

Keep `https://magsnap.me` as the permanent global primary entry point because printed MagSnap QR cards already point there.

Aliyun OSS + CDN is used for the China optimized mirror, not as the default replacement for the global main site.

Target domains:

```text
magsnap.me        Global primary entry for printed QR cards
www.magsnap.me    Global primary entry alias
cn.magsnap.me     China optimized mirror / fallback
api.magsnap.me    Global form API, Singapore first or Hong Kong fallback
media.magsnap.me  Public media CDN for Panda Masters photos and other public uploads
```

## Architecture

```text
Developer / Codex
  -> Git commit
  -> GitHub repository: MagsnapMZ/magsnap
  -> Global static deployment keeps magsnap.me and www.magsnap.me as the main entry
  -> Manual GitHub Actions workflow builds a static package
  -> Aliyun OSS stores the China mirror files
  -> Aliyun CDN serves cn.magsnap.me only
  -> api.magsnap.me receives global form submissions
  -> media.magsnap.me serves public uploaded media
```

Do not require users to open `cn.magsnap.me`. It is a China optimization mirror only. The printed-card entry remains `magsnap.me`.

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
  - Calls Aliyun CDN refresh.
- `scripts/deploy/verify_deployment.py`
  - Verifies live routes after mirror deployment.
- `api/aliyun-form-handler/`
  - Global form API handler package for `api.magsnap.me/forms`.
- `form_backend_aliyun.md`
  - Form API, private OSS, and media CDN configuration.

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
@      Global primary entry for printed QR cards
www    Global primary entry alias
cn     Aliyun China optimized mirror
api    Global API in Singapore or Hong Kong
media  Public media CDN
```

`magsnap.me` must remain valid globally and in China because printed cards already depend on it.

## Deployment

The Aliyun workflow is manual-only.

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

Form API checks:

- `https://api.magsnap.me/forms` health check returns `ok: true`.
- CORS allows:
  - `https://magsnap.me`
  - `https://www.magsnap.me`
  - `https://cn.magsnap.me`
- Real phone Panda Masters submission returns a standalone `photo_url`.
- Returned `photo_url` starts with `https://media.magsnap.me/`.

## China Compatibility

Current render-critical external dependency status:

- No Google Fonts
- No gstatic render dependency
- No YouTube embeds
- No Google Analytics render dependency

Global form submission:

- Public form submissions should use `https://api.magsnap.me/forms`.
- The API should run in Singapore first, or Hong Kong after real-world testing.
- The API should write private records to a private OSS bucket in the same region.
- Panda Masters photos should be written to a public media bucket and returned as an independent `photo_url` on `media.magsnap.me`.

Recommendation:

- Keep `magsnap.me` as the global primary entry.
- Use Aliyun OSS + CDN for `cn.magsnap.me` as the China optimized mirror.
- Keep Google Apps Script only as an optional back-office export/sync target.
- Do not put Google Apps Script on the user submission path.

## Maintenance

- Review `china_compatibility_report.md` after major frontend or form changes.
- Review Lighthouse artifacts after each mirror deployment.
- Rotate Aliyun RAM credentials regularly.
- Keep OSS release snapshots for a defined retention window.
- Test `magsnap.me`, `cn.magsnap.me`, `api.magsnap.me`, and `media.magsnap.me` from China and overseas before production changes.

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
- Confirm it is `cn.magsnap.me`, not `magsnap.me`.
- Check CDN permissions for the RAM user.
- Confirm CDN domain exists and is enabled.

Directory pages return 404:

- Confirm OSS static website hosting is enabled.
- Confirm CDN origin uses website endpoint behavior or equivalent rewrite behavior.
- Confirm `/path/index.html` files exist in OSS.
