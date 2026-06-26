# China Compatibility Report

Target URL: `https://magsnap.me`
Scanned root: `magsnap-deploy-v2`

## Summary

- Blocking external render dependencies found: `0`
- Non-render China-risk integrations found: `1`
- Google Fonts / gstatic / YouTube / Google Analytics should remain absent from render-critical markup.

## Blocking Render Dependencies

None found.

## China-Risk Integrations

- `www.instagram.com` in: index.html
  - Risk: Outbound social link may be unreachable from mainland China. It does not block page rendering.

## Recommendation

- Keep magsnap.me as the global primary entry for printed QR cards.
- Use Aliyun OSS + CDN for cn.magsnap.me as a China optimized mirror after ICP approval.
- Keep render-critical assets self-hosted in OSS/CDN.
- Use a globally reachable API such as api.magsnap.me in Singapore or Hong Kong for production form submissions.
- Use media.magsnap.me for public uploaded images so media URLs do not depend on the website hosting path.
- Keep Google Apps Script only as an optional back-office export/sync target, never as the China user submission path.
- Keep Instagram and other blocked social networks as outbound optional links only; do not load their SDKs or embeds.
