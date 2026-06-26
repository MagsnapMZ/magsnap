# Global Form Handler

Globally reachable form backend for MagSnap static pages. The default target is Singapore so Vietnam, Southeast Asia, China, Europe, and US users can submit through the same public API without being forced to a mainland China region.

## Runtime

- Aliyun Function Compute
- Node.js 20 or newer
- HTTP trigger or custom domain path `/forms`

## Environment Variables

- `OSS_REGION`: `oss-ap-southeast-1`
- `OSS_ENDPOINT`: optional, for example `oss-ap-southeast-1.aliyuncs.com`
- `FORM_DATA_BUCKET`: private bucket for form JSON records, recommended `magsnap-form-data-sg`
- `PHOTO_BUCKET`: public media bucket for Panda Masters photos, recommended `magsnap-public-media-sg`
- `PUBLIC_PHOTO_BASE_URL`: `https://media.magsnap.me`
- `ALLOWED_ORIGINS`: `https://magsnap.me,https://www.magsnap.me,https://cn.magsnap.me`
- `REQUIRE_ALLOWED_ORIGIN`: `true`
- `FORM_SHARED_SECRET`: optional shared secret; leave empty for public browser forms
- `FORM_BACKEND_DRY_RUN`: `false` in production

`FORM_DATA_BUCKET` and `PHOTO_BUCKET` must be configured explicitly. Do not use a shared website bucket for private form records.

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
