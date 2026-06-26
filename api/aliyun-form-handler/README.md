# Aliyun Form Handler

China-reachable form backend for MagSnap static pages.

## Runtime

- Aliyun Function Compute
- Node.js 20 or newer
- HTTP trigger or custom domain path `/forms`

## Environment Variables

- `OSS_REGION`: `oss-cn-hangzhou`
- `OSS_ENDPOINT`: optional, for example `oss-cn-hangzhou.aliyuncs.com`
- `FORM_DATA_BUCKET`: private bucket for form JSON records, recommended `magsnap-form-data`
- `PHOTO_BUCKET`: public/CDN-backed bucket for Panda Masters photos, currently `magsnap-web`
- `PUBLIC_PHOTO_BASE_URL`: `https://magsnap.me`
- `ALLOWED_ORIGINS`: `https://magsnap.me,https://www.magsnap.me`
- `REQUIRE_ALLOWED_ORIGIN`: `true`
- `FORM_SHARED_SECRET`: optional shared secret; leave empty for public browser forms
- `FORM_BACKEND_DRY_RUN`: `false` in production

Use a Function Compute RAM role where possible. If role credentials are not used, configure `ALIYUN_ACCESS_KEY_ID` and `ALIYUN_ACCESS_KEY_SECRET` as function environment secrets, not frontend code.

## OSS Layout

Private form records:

```text
submissions/<form>/<yyyy>/<mm>/<dd>/<submission_id>.json
```

Public Panda Masters photos:

```text
panda-masters/photos/incoming/<yyyy>/<mm>/<dd>/<panda_master_number>-<submission_id>.jpg
```

## Health Check

```bash
curl -sS https://api.magsnap.me/forms
```

Expected:

```json
{"ok":true,"service":"magsnap-aliyun-form-handler"}
```
