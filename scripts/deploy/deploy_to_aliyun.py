#!/usr/bin/env python3
"""Upload a prepared static site to Aliyun OSS with cache metadata."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


HTML_CACHE = "no-cache,max-age=0,must-revalidate"
SCRIPT_CACHE = "public,max-age=600,must-revalidate"
ASSET_CACHE = "public,max-age=2592000"


def required(name: str, value: str | None) -> str:
    if value:
        return value
    raise SystemExit(f"Missing required value: {name}")


def cache_control(path: Path) -> str:
    name = path.name.lower()
    suffix = path.suffix.lower()
    if suffix == ".html" or name in {"robots.txt", "sitemap.xml", "deployment_manifest.json"}:
        return HTML_CACHE
    if suffix in {".css", ".js", ".json", ".webmanifest"}:
        return SCRIPT_CACHE
    if suffix in {".avif", ".gif", ".ico", ".jpg", ".jpeg", ".mp4", ".png", ".svg", ".webp", ".woff", ".woff2"}:
        return ASSET_CACHE
    return SCRIPT_CACHE


def oss_key(prefix: str, relative_path: str) -> str:
    clean_prefix = prefix.strip("/")
    if clean_prefix:
        return f"{clean_prefix}/{relative_path}"
    return relative_path


def oss_url(bucket: str, key: str) -> str:
    return f"oss://{bucket}/{key}"


def upload_file(
    file_path: Path,
    relative_path: str,
    bucket: str,
    endpoint: str,
    access_key_id: str,
    access_key_secret: str,
    prefix: str,
    dry_run: bool,
) -> None:
    target = oss_url(bucket, oss_key(prefix, relative_path))
    command = [
        "ossutil",
        "cp",
        str(file_path),
        target,
        "-f",
        "-e",
        endpoint,
        "-i",
        access_key_id,
        "-k",
        access_key_secret,
        f"--meta=Cache-Control:{cache_control(file_path)}",
    ]
    if dry_run:
        print("DRY RUN:", " ".join(mask(command, access_key_id, access_key_secret)))
        return
    subprocess.run(command, check=True)


def mask(command: list[str], access_key_id: str, access_key_secret: str) -> list[str]:
    return ["***" if part in {access_key_id, access_key_secret} else part for part in command]


def upload_tree(site_dir: Path, bucket: str, endpoint: str, access_key_id: str, access_key_secret: str, prefix: str, dry_run: bool) -> int:
    count = 0
    for file_path in sorted(site_dir.rglob("*")):
        if not file_path.is_file():
            continue
        relative_path = file_path.relative_to(site_dir).as_posix()
        upload_file(file_path, relative_path, bucket, endpoint, access_key_id, access_key_secret, prefix, dry_run)
        count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy prepared static files to Aliyun OSS.")
    parser.add_argument("--site-dir", default="dist")
    parser.add_argument("--bucket", default=os.getenv("ALIYUN_OSS_BUCKET"))
    parser.add_argument("--endpoint", default=os.getenv("ALIYUN_OSS_ENDPOINT"))
    parser.add_argument("--access-key-id", default=os.getenv("ALIYUN_ACCESS_KEY_ID"))
    parser.add_argument("--access-key-secret", default=os.getenv("ALIYUN_ACCESS_KEY_SECRET"))
    parser.add_argument("--release", default=os.getenv("GITHUB_SHA", "local"))
    parser.add_argument("--prefix", default=os.getenv("ALIYUN_OSS_PREFIX", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    site_dir = Path(args.site_dir).resolve()
    if not site_dir.is_dir():
        raise SystemExit(f"Site directory does not exist: {site_dir}")

    bucket = required("ALIYUN_OSS_BUCKET", args.bucket)
    endpoint = required("ALIYUN_OSS_ENDPOINT", args.endpoint)
    access_key_id = required("ALIYUN_ACCESS_KEY_ID", args.access_key_id)
    access_key_secret = required("ALIYUN_ACCESS_KEY_SECRET", args.access_key_secret)
    release = required("release", args.release)

    release_prefix = oss_key(args.prefix, f"__releases/{release}")
    release_count = upload_tree(site_dir, bucket, endpoint, access_key_id, access_key_secret, release_prefix, args.dry_run)
    production_count = upload_tree(site_dir, bucket, endpoint, access_key_id, access_key_secret, args.prefix, args.dry_run)

    print(
        json.dumps(
            {
                "bucket": bucket,
                "endpoint": endpoint,
                "release": release,
                "release_prefix": release_prefix,
                "release_files": release_count,
                "production_files": production_count,
                "dry_run": args.dry_run,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
