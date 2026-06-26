# MagSnap China Form Backend

Goal: make MagSnap form submissions stable for mainland China users by removing Google Apps Script from the public submission path.

## Target Architecture

```text
Browser
  -> https://magsnap.me static site on Aliyun CDN
  -> https://api.magsnap.me/forms
  -> Aliyun Function Compute
  -> private OSS form records
  -> public OSS/CDN Panda Masters photo URLs
```

Google Sheet can remain a back-office export or sync target, but it must not be required for user submissions in China.

## Required Aliyun Resources

### 1. Private Form Data Bucket

Create a private OSS bucket:

- Bucket: `magsnap-form-data`
- Region: `cn-hangzhou` / OSS SDK region `oss-cn-hangzhou`
- ACL: private
- Public access: blocked
- Static website hosting: off

This bucket stores private JSON form records under:

```text
submissions/<form>/<yyyy>/<mm>/<dd>/<submission_id>.json
```

Do not store private form JSON in the public `magsnap-web` bucket.

### 2. Public Photo Bucket

Use the existing public/CDN-backed static bucket:

- Bucket: `magsnap-web`
- Region: `cn-hangzhou` / OSS SDK region `oss-cn-hangzhou`
- Photo prefix: `panda-masters/photos/incoming/`
- Public URL base: `https://magsnap.me`

The form API writes processed Panda Masters photos to:

```text
panda-masters/photos/incoming/<yyyy>/<mm>/<dd>/<panda_master_number>-<submission_id>.jpg
```

The API returns the final `photo_url` as a standalone field.

### 3. Function Compute

Create one Function Compute HTTP function:

- Name: `magsnap-form-handler`
- Runtime: Node.js 20
- Handler: `index.handler`
- Code directory: `api/aliyun-form-handler`
- HTTP methods: `GET`, `POST`, `OPTIONS`
- Public route: `/forms`
- Custom domain: `api.magsnap.me`
- HTTPS: enabled

Set environment variables:

```text
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
FORM_DATA_BUCKET=magsnap-form-data
PHOTO_BUCKET=magsnap-web
PUBLIC_PHOTO_BASE_URL=https://magsnap.me
ALLOWED_ORIGINS=https://magsnap.me,https://www.magsnap.me
REQUIRE_ALLOWED_ORIGIN=true
FORM_BACKEND_DRY_RUN=false
```

Leave `FORM_SHARED_SECRET` empty for public browser forms unless a separate token issuing flow is added.

### 4. RAM Permissions

Prefer a Function Compute RAM role over static AK/SK secrets.

Minimum policy scope:

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:HeadObject",
        "oss:ListObjects"
      ],
      "Resource": [
        "acs:oss:*:*:magsnap-form-data",
        "acs:oss:*:*:magsnap-form-data/submissions/*",
        "acs:oss:*:*:magsnap-web",
        "acs:oss:*:*:magsnap-web/panda-masters/photos/*"
      ]
    }
  ]
}
```

### 5. DNS

Add a DNS record after the Function Compute custom domain is created:

```text
api  CNAME  <Function Compute custom-domain CNAME target>
```

Do not change the existing production root record:

```text
@  CNAME  magsnap.me.w.kunlunaq.com
```

## Verification

Health check:

```bash
curl -sS https://api.magsnap.me/forms
```

Expected:

```json
{"ok":true,"service":"magsnap-aliyun-form-handler"}
```

POST test without a photo:

```bash
curl -sS https://api.magsnap.me/forms \
  -H 'Origin: https://magsnap.me' \
  -H 'Content-Type: application/json' \
  --data '{"source_form":"most_wanted_solution","name":"QA","contact_detail":"qa@example.com","solution_area":"Most Wanted #004","solution_description":"QA China API test"}'
```

Panda Masters photo test:

```bash
curl -sS https://api.magsnap.me/forms \
  -H 'Origin: https://magsnap.me' \
  -H 'Content-Type: application/json' \
  --data '{"source_form":"panda_masters_checkin","panda_master_number":"0004","public_nickname":"QA Panda","country":"China","city":"Shanghai","club":"MagSnap","role":"Creator","photo_url":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==","photo_link":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w=="}'
```

Confirm:

- Response includes `"ok": true`
- Response includes a standalone `photo_url`
- Private JSON record appears in `magsnap-form-data/submissions/...`
- Photo appears in `magsnap-web/panda-masters/photos/incoming/...`
- No browser request goes to `script.google.com`

## Rollback

If the API is not ready, do not cut DNS or deploy the frontend endpoint change to production.

After production cutover, rollback means:

1. Revert the frontend commit that points forms to `https://api.magsnap.me/forms`.
2. Redeploy the static site through the Aliyun OSS/CDN workflow.
3. Keep OSS form records; do not delete submitted data.
