#!/usr/bin/env python3
"""Validate the prepared static site before deployment."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


REQUIRED_FILES = ["index.html", "404.html", "robots.txt", "sitemap.xml", "favicon.svg", "site.webmanifest"]
BLOCKED_RENDER_HOSTS = {
    "ajax.googleapis.com",
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "googletagmanager.com",
    "google-analytics.com",
    "gstatic.com",
    "unpkg.com",
    "www.youtube.com",
    "youtube.com",
    "youtu.be",
}
CHINA_RISK_HOSTS = {
    "script.google.com",
    "www.instagram.com",
}


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[tuple[str, str]] = []
        self.meta: dict[tuple[str, str], str] = {}
        self.links: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key.lower(): value or "" for key, value in attrs}
        for name in ("href", "src", "poster"):
            value = attr.get(name)
            if value:
                self.refs.append((tag, value))
        if tag == "meta":
            if "property" in attr:
                self.meta[("property", attr["property"])] = attr.get("content", "")
            if "name" in attr:
                self.meta[("name", attr["name"])] = attr.get("content", "")
        if tag == "link" and "rel" in attr:
            self.links[attr["rel"].lower()] = attr.get("href", "")


def is_external(ref: str) -> bool:
    return ref.startswith("http://") or ref.startswith("https://") or ref.startswith("//")


def ref_host(ref: str) -> str:
    if ref.startswith("//"):
        ref = "https:" + ref
    return urlparse(ref).netloc.lower()


def is_ignored(ref: str) -> bool:
    return ref.startswith(("#", "mailto:", "tel:", "data:", "javascript:"))


def normalize_internal(ref: str, html_path: Path, site_dir: Path) -> str | None:
    if is_ignored(ref) or is_external(ref):
        return None
    path = ref.split("#", 1)[0].split("?", 1)[0]
    if not path:
        return None
    if path.startswith("/"):
        path = path[1:]
    else:
        base = html_path.relative_to(site_dir).parent.as_posix()
        path = posixpath.normpath(posixpath.join(base, path))
    if path in {"", "."}:
        path = "index.html"
    if path.startswith("../") or path == "..":
        return "__outside_deploy_root__"
    if path.endswith("/") or not Path(path).suffix:
        path = posixpath.join(path, "index.html")
    return path


def parse_html(path: Path) -> SiteParser:
    parser = SiteParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def validate_head(site_dir: Path, errors: list[str]) -> None:
    index = parse_html(site_dir / "index.html")
    required_meta = [
        ("property", "og:title"),
        ("property", "og:description"),
        ("property", "og:image"),
        ("property", "og:type"),
        ("property", "og:url"),
        ("name", "twitter:card"),
    ]
    for key in required_meta:
        if not index.meta.get(key):
            errors.append(f"index.html missing meta {key[1]}")
    if not index.links.get("canonical"):
        errors.append("index.html missing canonical link")
    if not index.links.get("icon"):
        errors.append("index.html missing favicon link")
    if not index.links.get("manifest"):
        errors.append("index.html missing manifest link")


def validate_refs(site_dir: Path, errors: list[str], warnings: list[str]) -> None:
    for html_path in sorted(site_dir.rglob("*.html")):
        parser = parse_html(html_path)
        for tag, ref in parser.refs:
            if is_external(ref):
                host = ref_host(ref)
                if host in BLOCKED_RENDER_HOSTS:
                    errors.append(f"{html_path.relative_to(site_dir)} uses blocked render host in {tag}: {ref}")
                elif host in CHINA_RISK_HOSTS:
                    warnings.append(f"{html_path.relative_to(site_dir)} references China-risk host in {tag}: {ref}")
                continue
            normalized = normalize_internal(ref, html_path, site_dir)
            if not normalized:
                continue
            if normalized == "__outside_deploy_root__":
                errors.append(f"{html_path.relative_to(site_dir)} references outside deploy root: {ref}")
                continue
            target = site_dir / normalized
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                errors.append(f"{html_path.relative_to(site_dir)} references missing file: {ref}")


def scan_inline_hosts(site_dir: Path, warnings: list[str]) -> None:
    pattern = re.compile(r"https?://([^/\"')\s]+)")
    for path in sorted(site_dir.rglob("*")):
        if path.suffix.lower() not in {".html", ".js", ".css"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for host in sorted(set(match.group(1).lower() for match in pattern.finditer(text))):
            if host in CHINA_RISK_HOSTS:
                warnings.append(f"{path.relative_to(site_dir)} contains China-risk endpoint: {host}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify prepared static site.")
    parser.add_argument("--site-dir", default="dist")
    parser.add_argument("--json-output")
    args = parser.parse_args()

    site_dir = Path(args.site_dir).resolve()
    errors: list[str] = []
    warnings: list[str] = []

    for required_file in REQUIRED_FILES:
        if not (site_dir / required_file).exists():
            errors.append(f"Missing required file: {required_file}")

    if (site_dir / "index.html").exists():
        validate_head(site_dir, errors)
    validate_refs(site_dir, errors, warnings)
    scan_inline_hosts(site_dir, warnings)

    result = {"errors": errors, "warnings": sorted(set(warnings))}
    if args.json_output:
        Path(args.json_output).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
