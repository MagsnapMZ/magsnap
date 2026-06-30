#!/usr/bin/env python3
"""Resolve the OSS bucket and endpoint currently used by an Aliyun CDN domain."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlparse


OSS_ORIGIN_PATTERN = re.compile(
    r"^(?P<bucket>[^./]+)\.(?P<endpoint>oss(?:-website)?-[A-Za-z0-9-]+\.aliyuncs\.com(?:\.cn)?)$"
)


def normalize_domain(value: str) -> str:
    value = value.strip()
    if value.startswith(("http://", "https://")):
        value = urlparse(value).netloc
    return value.strip("/")


def walk_strings(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(walk_strings(item))
        return result
    if isinstance(value, dict):
        result = []
        for item in value.values():
            result.extend(walk_strings(item))
        return result
    return []


def clean_origin(value: str) -> str:
    value = value.strip()
    if value.startswith(("http://", "https://")):
        value = urlparse(value).netloc
    return value.split("/", 1)[0].split(":", 1)[0].strip()


def find_oss_origin(payload: object) -> tuple[str, str] | None:
    for value in walk_strings(payload):
        origin = clean_origin(value)
        match = OSS_ORIGIN_PATTERN.match(origin)
        if match:
            return match.group("bucket"), match.group("endpoint")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve CDN OSS origin and optionally write GitHub env values.")
    parser.add_argument("--domain", required=True, help="Aliyun CDN domain or site base URL.")
    parser.add_argument("--profile", default="magsnap-prod")
    parser.add_argument("--env-output", help="Path to GitHub Actions env output file.")
    args = parser.parse_args()

    domain = normalize_domain(args.domain)
    command = [
        "aliyun",
        "cdn",
        "DescribeCdnDomainDetail",
        "--profile",
        args.profile,
        "--DomainName",
        domain,
    ]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    origin = find_oss_origin(payload)
    if not origin:
        print(json.dumps({"domain": domain, "resolved": False}, indent=2))
        return 0

    bucket, endpoint = origin
    if args.env_output:
        with Path(args.env_output).open("a", encoding="utf-8") as handle:
            handle.write(f"ALIYUN_OSS_BUCKET={bucket}\n")
            handle.write(f"ALIYUN_OSS_ENDPOINT={endpoint}\n")

    print(json.dumps({"domain": domain, "resolved": True, "bucket": bucket, "endpoint": endpoint}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
