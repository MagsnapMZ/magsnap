# MagSnap Global Entry + China Optimization Recommendation

Date: 2026-06-26

Status: PR #2 adjustment guidance. Do not merge PR #2 until the checklist below is complete.

## Non-Negotiable Constraint

MagSnap has printed and distributed physical cards with QR codes fixed to:

```text
https://magsnap.me
```

Therefore `magsnap.me` must remain the permanent global primary entry point. China optimization cannot require users to open `cn.magsnap.me`, and overseas optimization cannot make the printed QR fail in China.

## Final Target Architecture

```text
magsnap.me
www.magsnap.me
  -> global primary entry, valid for China, Vietnam, Southeast Asia, Europe, and US

cn.magsnap.me
  -> China optimized mirror / fallback only

api.magsnap.me
  -> global form API, Singapore first or Hong Kong fallback

media.magsnap.me
  -> public media CDN for Panda Masters photos and other public uploads
```

## PR #2 Merge Status

PR #2 should remain open and unmerged until:

- API defaults are Singapore or Hong Kong, not mainland China.
- Private form data defaults to a same-region private bucket such as `magsnap-form-data-sg`.
- Panda Masters photo URLs use `https://media.magsnap.me/...`.
- CORS allows `magsnap.me`, `www.magsnap.me`, and `cn.magsnap.me`.
- Aliyun static deployment docs target `cn.magsnap.me`, not the global printed-card entry.
- Node, Python, static verify, China compatibility, and `git diff --check` all pass.

## Current PR #2 Adjustment

The correct PR #2 direction is:

```text
Frontend form endpoint:
  https://api.magsnap.me/forms

API default region:
  Singapore / oss-ap-southeast-1

Private form bucket:
  magsnap-form-data-sg

Public media bucket:
  magsnap-public-media-sg

Public photo URL:
  https://media.magsnap.me/panda-masters/photos/incoming/...
```

Hong Kong is acceptable as a fallback:

```text
OSS_REGION=oss-cn-hongkong
OSS_ENDPOINT=oss-cn-hongkong.aliyuncs.com
FORM_DATA_BUCKET=magsnap-form-data-hk
PHOTO_BUCKET=magsnap-public-media-hk
```

Do not use `cn-hangzhou` as the global form API default.

## Domain Responsibilities

### `magsnap.me`

- Printed QR entry.
- Must remain valid globally.
- Must not be treated as a China-only deployment target.
- Must not depend on users knowing a China mirror URL.

### `cn.magsnap.me`

- China optimized mirror.
- Useful for WeChat/manual fallback, diagnostics, and China CDN testing.
- Not the printed QR entry.

### `api.magsnap.me`

- Shared form API for all site copies.
- Should run in Singapore first, or Hong Kong after testing.
- Must not be Google Apps Script.
- Must write private records to private OSS.

### `media.magsnap.me`

- Public CDN for user-visible media.
- Used by Panda Masters Wall and future public image surfaces.
- Must be independent of where the static website is hosted.

## Required Manual Checks Before Merge

1. `https://api.magsnap.me/forms` health check returns `ok: true`.
2. API CORS accepts:
   - `https://magsnap.me`
   - `https://www.magsnap.me`
   - `https://cn.magsnap.me`
3. A real phone Panda Masters submission succeeds.
4. The returned `photo_url` starts with `https://media.magsnap.me/`.
5. The returned `photo_url` opens from China and overseas.
6. Private JSON records are only in the private form data bucket.
7. Public buckets contain only public media/static assets.
8. No production DNS is changed by PR merge.

## DNS Policy

Desired roles:

```text
@      Global primary entry for printed QR cards
www    Global primary entry alias
cn     Aliyun China optimized mirror
api    Function Compute custom domain target, Singapore or Hong Kong
media  Public media CDN target
```

Do not use PR #2 to switch `magsnap.me` into a China-only site.

## Source Notes

- Alibaba Cloud global infrastructure lists Singapore and China (Hong Kong) as regions outside mainland China: https://www.alibabacloud.com/global-locations
- Alibaba Cloud OSS region documentation lists Singapore as `ap-southeast-1` with endpoint `oss-ap-southeast-1.aliyuncs.com`, and China (Hong Kong) as `cn-hongkong` with endpoint `oss-cn-hongkong.aliyuncs.com`: https://www.alibabacloud.com/help/en/oss/user-guide/regions-and-endpoints
