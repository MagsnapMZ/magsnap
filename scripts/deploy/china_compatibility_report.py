#!/usr/bin/env python3
"""Generate a China compatibility report for static deployment."""

from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse


HOST_RE = re.compile(r"https?://([^/\"')\s]+)")
BLOCKING_HOSTS = {
    "ajax.googleapis.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "googletagmanager.com",
    "google-analytics.com",
    "gstatic.com",
    "www.youtube.com",
    "youtube.com",
    "youtu.be",
}
RISK_HOSTS = {
    "script.google.com": "Form submission endpoint may be unreachable from mainland China. Rendering is not blocked, but submissions can fail.",
    "www.instagram.com": "Outbound social link may be unreachable from mainland China. It does not block page rendering.",
}
SKIP_DIRS = {".git", ".github", "backups", "deployment-artifacts", "dist", "node_modules", "scripts", "supabase", "tests"}
SKIP_FILES = {"index_v1_backup.html", "project-context.xml"}


def scan(root: Path) -> dict[str, set[str]]:
    results: dict[str, set[str]] = defaultdict(set)
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if any(part in SKIP_DIRS for part in relative.parts[:-1]):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.is_dir() or path.suffix.lower() not in {".html", ".js", ".css", ".json", ".webmanifest", ".xml", ".txt"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in HOST_RE.finditer(text):
            host = urlparse("https://" + match.group(1)).netloc.lower()
            results[host].add(path.relative_to(root).as_posix())
    return results


def render_report(root: Path, base_url: str) -> str:
    results = scan(root)
    blocking = {host: sorted(files) for host, files in results.items() if host in BLOCKING_HOSTS}
    risks = {host: sorted(files) for host, files in results.items() if host in RISK_HOSTS}

    lines = [
        "# China Compatibility Report",
        "",
        f"Target URL: `{base_url}`",
        f"Scanned root: `{root.name if root.name else root}`",
        "",
        "## Summary",
        "",
        f"- Blocking external render dependencies found: `{len(blocking)}`",
        f"- Non-render China-risk integrations found: `{len(risks)}`",
        "- Google Fonts / gstatic / YouTube / Google Analytics should remain absent from render-critical markup.",
        "",
        "## Blocking Render Dependencies",
        "",
    ]
    if blocking:
        for host, files in blocking.items():
            lines.append(f"- `{host}` in: {', '.join(files)}")
    else:
        lines.append("None found.")

    lines.extend(["", "## China-Risk Integrations", ""])
    if risks:
        for host, files in risks.items():
            lines.append(f"- `{host}` in: {', '.join(files)}")
            lines.append(f"  - Risk: {RISK_HOSTS[host]}")
    else:
        lines.append("None found.")

    lines.extend(
        [
            "",
            "## Recommendation",
            "",
            "- Keep GitHub Pages as the overseas primary host for magsnap.me.",
            "- Use Aliyun OSS + CDN for cn.magsnap.me as a China optimized mirror after ICP approval.",
            "- Evaluate DNS-level regional routing for magsnap.me on a non-production test hostname before changing the printed QR domain.",
            "- Keep render-critical assets self-hosted in OSS/CDN.",
            "- Keep Google Apps Script as the current form backend unless real China submission failures are confirmed.",
            "- Treat form backend and media storage migration as a separate later project, not part of this mirror/routing PR.",
            "- Keep Instagram and other blocked social networks as outbound optional links only; do not load their SDKs or embeds.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate China compatibility report.")
    parser.add_argument("--root", default=".")
    parser.add_argument("--base-url", default="https://magsnap.me")
    parser.add_argument("--output", default="china_compatibility_report.md")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    report = render_report(root, args.base_url)
    Path(args.output).write_text(report, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
