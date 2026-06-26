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

- Keep GitHub Pages as the overseas primary host for magsnap.me.
- Use Aliyun OSS + CDN for cn.magsnap.me as a China optimized mirror after ICP approval.
- Evaluate DNS-level regional routing for magsnap.me on a non-production test hostname before changing the printed QR domain.
- Keep render-critical assets self-hosted in OSS/CDN.
- Keep Google Apps Script as the current form backend unless real China submission failures are confirmed.
- Treat form backend and media storage migration as a separate later project, not part of this mirror/routing PR.
- Keep Instagram and other blocked social networks as outbound optional links only; do not load their SDKs or embeds.
