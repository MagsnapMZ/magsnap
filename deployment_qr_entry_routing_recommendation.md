# MagSnap QR Entry Routing Recommendation

Date: 2026-06-26

Status: PR #2 recommendation. Do not merge PR #2 until routing has been tested on a non-production hostname.

## Core Constraint

MagSnap has printed physical cards with QR codes fixed to:

```text
https://magsnap.me
```

That domain must remain the single long-term public entry. Users must not be asked to type `cn.magsnap.me`.

## Current Target

```text
magsnap.me / www.magsnap.me
  -> single QR-code entry
  -> overseas primary should remain GitHub Pages

cn.magsnap.me
  -> China optimized mirror
  -> used by routing or diagnostics, not by manual user instruction
```

This recommendation intentionally pauses:

- Singapore OSS
- Function Compute
- New global API
- `media.magsnap.me`
- Public/private form storage migration

Form backend work should remain deferred unless real Google Apps Script or image-upload failures are confirmed.

## Recommended Architecture

```text
Overseas user
  -> https://magsnap.me
  -> GitHub Pages

China user
  -> https://magsnap.me
  -> regional routing
  -> Aliyun OSS/CDN mirror

Direct mirror check
  -> https://cn.magsnap.me
  -> Aliyun OSS/CDN
```

The key technical question is not whether `cn.magsnap.me` can work. It can. The key question is whether the apex QR domain can be routed by region without hurting overseas traffic.

## Option A: DNS-Level Regional Routing

Preferred first test.

Use an authoritative DNS provider that supports source-aware routing:

```text
Host: qr-test.magsnap.me

Line: China / Mainland China
Value: Aliyun CDN target for the mirror

Line: Default / Overseas
Value: GitHub Pages target
```

After test success, the same pattern can be considered for:

```text
magsnap.me
www.magsnap.me
```

### Provider Notes

Aliyun Cloud DNS supports intelligent DNS resolution by checking the request source and returning different records. Its documentation also notes that source detection is based on EDNS Client Subnet when available, otherwise LocalDNS egress IP. This is useful but not perfect, so real mobile-network testing is required.

Cloudflare Load Balancing supports Geo steering to route traffic to pools by country or region. Cloudflare also documents using Pages as a load balancing origin, but China Network support requires a valid ICP license and zone access to the China Network.

DNSPod/Tencent DNS can be evaluated as an alternative if AliDNS routing does not provide the needed line granularity or apex record behavior, but it should be tested on a non-production hostname first.

## Option B: Edge Redirect

Possible but not the first choice.

An edge layer receives `magsnap.me`, detects country, and routes:

```text
China -> cn.magsnap.me or Aliyun mirror origin
Other -> GitHub Pages origin
```

This requires moving the QR entry through the edge provider. That can solve routing, but it also means GitHub Pages is no longer the direct DNS target for the apex. Use only if DNS-level routing is unreliable.

## Option C: Homepage JavaScript Redirect

Not sufficient for the main China access problem.

A lightweight script can redirect China users to `cn.magsnap.me` after the page loads, but if GitHub Pages is blocked or too slow to load in China, the script never runs. This option can improve partial-load cases only; it cannot fix a complete open failure.

## Recommendation

1. Keep GitHub Pages as the overseas main host.
2. Keep PR #2 focused on deploying the Aliyun mirror at `cn.magsnap.me`.
3. Do not merge PR #2 yet.
4. Create and test a routing hostname such as `qr-test.magsnap.me`.
5. On the test hostname:
   - China line returns Aliyun CDN mirror.
   - Default/overseas line returns GitHub Pages.
6. Test from:
   - Mainland China mobile network
   - WeChat scanner/browser
   - Vietnam mobile network
   - US/EU network
7. Only after successful tests, consider applying the same routing pattern to `magsnap.me`.

## DNS Test Checklist

- `cn.magsnap.me` opens in mainland China.
- `cn.magsnap.me` serves the same Git commit as GitHub Pages.
- `qr-test.magsnap.me` opens from China and reaches Aliyun.
- `qr-test.magsnap.me` opens from Vietnam and reaches GitHub Pages.
- `qr-test.magsnap.me` opens from US/EU and reaches GitHub Pages.
- TLS certificate is valid on every path.
- Canonical URLs remain `https://magsnap.me/...`.
- No business page design changes are introduced.
- Form submission behavior is unchanged.

## Rollback Policy

DNS-level routing must be reversible:

1. Keep low TTL during testing.
2. Keep GitHub Pages DNS records documented and ready.
3. Keep Aliyun mirror DNS separate under `cn.magsnap.me`.
4. If routing fails, restore `magsnap.me` to the GitHub Pages target.

## Sources

- GitHub Pages supports custom domains including apex and `www` domains, and documents the GitHub Pages A records and subdomain CNAME setup: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- Aliyun Cloud DNS intelligent resolution can return different records by request source and explains the EDNS/LocalDNS source-detection behavior: https://help.aliyun.com/zh/dns/intelligent-dns-resolution
- Cloudflare Load Balancing Geo steering routes traffic by country or region: https://developers.cloudflare.com/load-balancing/understand-basics/traffic-steering/steering-policies/geo-steering/
- Cloudflare documents using Pages as a Load Balancing origin: https://developers.cloudflare.com/load-balancing/pools/cloudflare-pages-origin/
- Cloudflare China Network load balancing requires an ICP license and China Network access: https://developers.cloudflare.com/load-balancing/additional-options/load-balancing-china/
