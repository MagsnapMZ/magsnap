#!/usr/bin/env python3
"""Submit an Aliyun CDN refresh task for the production domain."""

from __future__ import annotations

import argparse
import json
import os
import subprocess


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh Aliyun CDN cache.")
    parser.add_argument("--domain", default=os.getenv("ALIYUN_CDN_DOMAIN"))
    parser.add_argument("--profile", default=os.getenv("ALIYUN_CLI_PROFILE", "magsnap-prod"))
    parser.add_argument("--object-type", default="Directory", choices=["Directory", "File", "Regex", "ExQuery"])
    parser.add_argument("--path", action="append", help="URL or directory path to refresh. Defaults to the domain root.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.domain:
        raise SystemExit("Missing required value: ALIYUN_CDN_DOMAIN")

    domain = args.domain.replace("https://", "").replace("http://", "").strip("/")
    paths = args.path or [f"https://{domain}/"]
    object_path = "\n".join(paths)
    command = [
        "aliyun",
        "cdn",
        "RefreshObjectCaches",
        "--profile",
        args.profile,
        "--ObjectPath",
        object_path,
        "--ObjectType",
        args.object_type,
    ]
    if args.dry_run:
        print("DRY RUN:", json.dumps({"command": command, "paths": paths}, indent=2))
        return 0
    subprocess.run(command, check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
