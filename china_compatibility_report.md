# China Compatibility Report

Target URL: `https://magsnap.me`
Scanned root: `magsnap-deploy-v2`

## Summary

- Blocking external render dependencies found: `0`
- Non-render China-risk integrations found: `2`
- Google Fonts / gstatic / YouTube / Google Analytics should remain absent from render-critical markup.

## Blocking Render Dependencies

None found.

## China-Risk Integrations

- `script.google.com` in: index.html, most-wanted/index.html, panda-masters/index.html
  - Risk: Form submission endpoint may be unreachable from mainland China. Rendering is not blocked, but submissions can fail.
- `www.instagram.com` in: index.html
  - Risk: Outbound social link may be unreachable from mainland China. It does not block page rendering.

## Recommendation

- Aliyun OSS + CDN is the correct production hosting target for China access after ICP approval.
- Keep render-critical assets self-hosted in OSS/CDN.
- Keep Google Apps Script as a temporary form backend only if China submissions are not business-critical.
- For full China readiness, migrate public form submission endpoints from Google Apps Script to an API hosted on Aliyun, Cloudflare China-compatible service, or another China-reachable backend.
- Keep Instagram and other blocked social networks as outbound optional links only; do not load their SDKs or embeds.
