# MagSnap Global Form Backend

Goal: make MagSnap form submissions stable for China, Vietnam, Southeast Asia, Europe, and US users without turning China into the only production path.

## Non-Negotiable Entry Point

Printed MagSnap cards already point QR codes to:

```text
https://magsnap.me
```

That domain must remain the global primary entry point. Users must not be required to switch to `cn.magsnap.me` or any other domain after scanning printed cards.

## Target Architecture

```text
https://magsnap.me
https://www.magsnap.me
  -> global primary website entry

https://cn.magsnap.me
  -> China optimized mirror / fallback, not the QR-code entry

https://api.magsnap.me/forms
  -> global form API in Singapore first, Hong Kong as fallback

https://media.magsnap.me
  -> public media CDN for Panda Masters photos and other public uploads
```

Google Sheet can remain a back-office export or sync target, but it must not be required for user submissions.

## API Region

Default recommendation:

```text
Region: Singapore
OSS SDK region: oss-ap-southeast-1
OSS endpoint: oss-ap-southeast-1.aliyuncs.com
```

Fallback option:

```text
Region: China (Hong Kong)
OSS SDK region: oss-cn-hongkong
OSS endpoint: oss-cn-hongkong.aliyuncs.com
```

Do not use `cn-hangzhou` as the default API region. The API is global infrastructure, not a China-mainland-only backend.

## Required Aliyun Resources

### 1. Private Form Data Bucket

Create a private OSS bucket in the same region as the API:

```text
Singapore: magsnap-form-data-sg
Hong Kong: magsnap-form-data-hk
```

Required settings:

- ACL: private
- Public access: blocked
- Static website hosting: off

Private form JSON records are written under:

```text
submissions/<form>/<yyyy>/<mm>/<dd>/<submission_id>.json
```

Private form JSON must not be stored in the public static website bucket.

### 2. Public Media Bucket

Create a separate public/CDN-backed media bucket:

```text
Singapore: magsnap-public-media-sg
Hong Kong: magsnap-public-media-hk
```

Required public domain:

```text
https://media.magsnap.me
```

This bucket is for public media only, such as Panda Masters photos:

```text
panda-masters/photos/incoming/<yyyy>/<mm>/<dd>/<panda_master_number>-<submission_id>.jpg
```

The API returns the final `photo_url` as:

```text
https://media.magsnap.me/panda-masters/photos/incoming/...
```

Do not return `https://magsnap.me/panda-masters/photos/...` because `magsnap.me` must remain independent from the media storage backend.

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

Recommended Singapore environment variables:

```text
OSS_REGION=oss-ap-southeast-1
OSS_ENDPOINT=oss-ap-southeast-1.aliyuncs.com
FORM_DATA_BUCKET=magsnap-form-data-sg
PHOTO_BUCKET=magsnap-public-media-sg
PUBLIC_PHOTO_BASE_URL=https://media.magsnap.me
ALLOWED_ORIGINS=https://magsnap.me,https://www.magsnap.me,https://cn.magsnap.me
REQUIRE_ALLOWED_ORIGIN=true
FORM_BACKEND_DRY_RUN=false
```

Hong Kong alternative:

```text
OSS_REGION=oss-cn-hongkong
OSS_ENDPOINT=oss-cn-hongkong.aliyuncs.com
FORM_DATA_BUCKET=magsnap-form-data-hk
PHOTO_BUCKET=magsnap-public-media-hk
PUBLIC_PHOTO_BASE_URL=https://media.magsnap.me
ALLOWED_ORIGINS=https://magsnap.me,https://www.magsnap.me,https://cn.magsnap.me
REQUIRE_ALLOWED_ORIGIN=true
FORM_BACKEND_DRY_RUN=false
```

Leave `FORM_SHARED_SECRET` empty for public browser forms unless a separate token issuing flow is added.

### 4. RAM Permissions

Prefer a Function Compute RAM role over static AK/SK secrets.

Minimum Singapore policy scope:

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
        "acs:oss:*:*:magsnap-form-data-sg",
        "acs:oss:*:*:magsnap-form-data-sg/submissions/*",
        "acs:oss:*:*:magsnap-public-media-sg",
        "acs:oss:*:*:magsnap-public-media-sg/panda-masters/photos/*"
      ]
    }
  ]
}
```

Use the `-hk` bucket names if the API is deployed in Hong Kong.

### 5. DNS

Required end state:

```text
@      -> global primary website entry for printed QR cards
www    -> global primary website entry
cn     -> China optimized mirror
api    -> Function Compute custom domain target in Singapore or Hong Kong
media  -> public media CDN target
```

Do not make `cn.magsnap.me` the required user entry point. It is a fallback/mirror only.

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
  --data '{"source_form":"most_wanted_solution","name":"QA","contact_detail":"qa@example.com","solution_area":"Most Wanted #004","solution_description":"QA global API test"}'
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
- `photo_url` starts with `https://media.magsnap.me/`
- Private JSON record appears in `magsnap-form-data-sg/submissions/...`
- Photo appears in `magsnap-public-media-sg/panda-masters/photos/incoming/...`
- No browser request goes to `script.google.com`
- Test from a real phone on China network and a non-China network before merging.

## Rollback

If the API is not ready, do not merge the frontend endpoint change.

After production cutover, rollback means:

1. Revert the frontend commit that points forms to `https://api.magsnap.me/forms`.
2. Redeploy the affected static site.
3. Keep OSS form records and uploaded public photos; do not delete submitted data.
