#!/usr/bin/env python3
"""Generate a static and optional Lighthouse performance report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def human_size(size: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return f"{size} B"


def collect_files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*") if path.is_file())


def parse_lighthouse(path: Path | None) -> dict[str, float] | None:
    if not path or not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    categories = data.get("categories", {})
    return {
        "performance": categories.get("performance", {}).get("score", 0.0),
        "accessibility": categories.get("accessibility", {}).get("score", 0.0),
        "best_practices": categories.get("best-practices", {}).get("score", 0.0),
        "seo": categories.get("seo", {}).get("score", 0.0),
    }


def render_report(site_dir: Path, base_url: str, lighthouse: dict[str, float] | None, min_score: float) -> tuple[str, bool]:
    files = collect_files(site_dir)
    total = sum(path.stat().st_size for path in files)
    by_suffix: dict[str, int] = {}
    for path in files:
        suffix = path.suffix.lower() or "[no extension]"
        by_suffix[suffix] = by_suffix.get(suffix, 0) + path.stat().st_size
    largest = sorted(files, key=lambda path: path.stat().st_size, reverse=True)[:12]

    lines = [
        "# Performance Report",
        "",
        f"Target URL: `{base_url}`",
        f"Static package: `{site_dir.name if site_dir.name else site_dir}`",
        "",
        "## Static Package Summary",
        "",
        f"- File count: `{len(files)}`",
        f"- Total size: `{human_size(total)}`",
        "",
        "## Size By Type",
        "",
    ]
    for suffix, size in sorted(by_suffix.items(), key=lambda item: item[1], reverse=True):
        lines.append(f"- `{suffix}`: {human_size(size)}")

    lines.extend(["", "## Largest Files", ""])
    for path in largest:
        lines.append(f"- `{path.relative_to(site_dir).as_posix()}`: {human_size(path.stat().st_size)}")

    passed = True
    lines.extend(["", "## Lighthouse", ""])
    if lighthouse:
        for key, score in lighthouse.items():
            percent = round(score * 100)
            lines.append(f"- {key.replace('_', ' ').title()}: `{percent}`")
            if score < min_score:
                passed = False
        lines.append("")
        lines.append(f"Required minimum score: `{round(min_score * 100)}`")
    else:
        lines.append("Lighthouse data was not available in this local report. The GitHub Actions workflow runs Lighthouse against the deployed URL and writes an artifact report.")

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- HTML is uploaded with `no-cache` metadata.",
            "- CSS and JS are uploaded with short cache metadata because filenames are not content-hashed.",
            "- Images and videos are uploaded with long cache metadata.",
            "- CDN compression should be enabled in Aliyun CDN for gzip and Brotli where available.",
            "",
        ]
    )
    return "\n".join(lines), passed


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate performance report.")
    parser.add_argument("--site-dir", default="dist")
    parser.add_argument("--base-url", default="https://magsnap.me")
    parser.add_argument("--lighthouse-json")
    parser.add_argument("--output", default="performance_report.md")
    parser.add_argument("--min-score", type=float, default=0.95)
    parser.add_argument("--enforce-lighthouse", action="store_true")
    args = parser.parse_args()

    site_dir = Path(args.site_dir).resolve()
    lighthouse = parse_lighthouse(Path(args.lighthouse_json)) if args.lighthouse_json else None
    report, passed = render_report(site_dir, args.base_url, lighthouse, args.min_score)
    Path(args.output).write_text(report, encoding="utf-8")
    print(args.output)
    if args.enforce_lighthouse and lighthouse and not passed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
