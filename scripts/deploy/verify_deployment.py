#!/usr/bin/env python3
"""Verify the live deployment after Aliyun OSS + CDN publish."""

from __future__ import annotations

import argparse
import json
import time
from html.parser import HTMLParser
from pathlib import PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/126 Safari/537.36"
MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key.lower(): value or "" for key, value in attrs}
        for key in ("src", "href", "poster"):
            value = attr.get(key)
            if value and not value.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
                self.assets.append(value)
        if tag == "meta":
            if "property" in attr:
                self.meta[attr["property"]] = attr.get("content", "")
            if "name" in attr:
                self.meta[attr["name"]] = attr.get("content", "")
        if tag == "link" and "rel" in attr:
            self.links[attr["rel"].lower()] = attr.get("href", "")


def fetch(url: str, user_agent: str, timeout: int = 20) -> tuple[int, dict[str, str], bytes]:
    request = Request(url, headers={"User-Agent": user_agent})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()
    except HTTPError as error:
        return error.code, {key.lower(): value for key, value in error.headers.items()}, error.read()


def check_url(base_url: str, path: str, expected: set[int], user_agent: str, errors: list[str], retries: int, sleep_seconds: float) -> tuple[int, dict[str, str], bytes]:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    last_status = 0
    last_headers: dict[str, str] = {}
    last_body = b""
    for attempt in range(1, retries + 1):
        status, headers, body = fetch(url, user_agent)
        last_status, last_headers, last_body = status, headers, body
        if status in expected:
            return status, headers, body
        if attempt < retries:
            time.sleep(sleep_seconds)
    errors.append(f"{url} returned {last_status}; expected one of {sorted(expected)}")
    return last_status, last_headers, last_body


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify deployed static website.")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--disallow-server", default="")
    parser.add_argument("--retries", type=int, default=6)
    parser.add_argument("--sleep", type=float, default=10)
    parser.add_argument("--json-output")
    args = parser.parse_args()

    errors: list[str] = []
    checks: list[dict[str, object]] = []
    required_paths = [
        "/",
        "/404.html",
        "/robots.txt",
        "/sitemap.xml",
        "/site.webmanifest",
        "/favicon.svg",
        "/panda-masters/",
        "/most-wanted/",
        "/registry/",
        "/assets/founder/founder.css",
        "/assets/founder/founder.js",
        "/assets/site/panda-logo.jpg",
    ]

    for path in required_paths:
        status, headers, body = check_url(args.base_url, path, {200}, DESKTOP_UA, errors, args.retries, args.sleep)
        checks.append({"path": path, "status": status, "bytes": len(body), "server": headers.get("server", "")})
        if args.disallow_server and args.disallow_server.lower() in headers.get("server", "").lower():
            errors.append(f"{path} is still served by disallowed server: {headers.get('server')}")

    status, _, mobile_body = check_url(args.base_url, "/", {200}, MOBILE_UA, errors, args.retries, args.sleep)
    checks.append({"path": "/", "mode": "mobile-user-agent", "status": status, "bytes": len(mobile_body)})
    if b"MAGSNAP" not in mobile_body:
        errors.append("Mobile homepage response does not contain MAGSNAP marker")

    parser_result = AssetParser()
    parser_result.feed(mobile_body.decode("utf-8", errors="ignore"))
    for required_meta in ("og:title", "og:description", "og:image", "og:type", "og:url", "twitter:card"):
        if not parser_result.meta.get(required_meta):
            errors.append(f"Homepage missing live meta tag: {required_meta}")
    for required_link in ("canonical", "icon", "manifest"):
        if not parser_result.links.get(required_link):
            errors.append(f"Homepage missing live link tag: {required_link}")

    for asset in [parser_result.meta.get("og:image", ""), parser_result.links.get("icon", ""), parser_result.links.get("manifest", "")]:
        if not asset:
            continue
        asset_path = asset if asset.startswith(("http://", "https://")) else "/" + str(PurePosixPath(asset.lstrip("/")))
        status, _, body = check_url(args.base_url, asset_path, {200}, DESKTOP_UA, errors, args.retries, args.sleep)
        checks.append({"asset": asset_path, "status": status, "bytes": len(body)})

    result = {"base_url": args.base_url, "checks": checks, "errors": errors}
    if args.json_output:
        from pathlib import Path

        Path(args.json_output).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
