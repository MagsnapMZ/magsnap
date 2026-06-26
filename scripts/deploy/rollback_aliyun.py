#!/usr/bin/env python3
"""Restore a previously uploaded OSS release snapshot to production root."""

from __future__ import annotations

import argparse
import json
import os
import subprocess


def required(name: str, value: str | None) -> str:
    if value:
        return value
    raise SystemExit(f"Missing required value: {name}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Rollback Aliyun OSS production files to a prior release snapshot.")
    parser.add_argument("--release", required=True, help="Release SHA or snapshot directory under __releases/.")
    parser.add_argument("--bucket", default=os.getenv("ALIYUN_OSS_BUCKET"))
    parser.add_argument("--endpoint", default=os.getenv("ALIYUN_OSS_ENDPOINT"))
    parser.add_argument("--access-key-id", default=os.getenv("ALIYUN_ACCESS_KEY_ID"))
    parser.add_argument("--access-key-secret", default=os.getenv("ALIYUN_ACCESS_KEY_SECRET"))
    parser.add_argument("--prefix", default=os.getenv("ALIYUN_OSS_PREFIX", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    bucket = required("ALIYUN_OSS_BUCKET", args.bucket)
    endpoint = required("ALIYUN_OSS_ENDPOINT", args.endpoint)
    access_key_id = required("ALIYUN_ACCESS_KEY_ID", args.access_key_id)
    access_key_secret = required("ALIYUN_ACCESS_KEY_SECRET", args.access_key_secret)
    prefix = args.prefix.strip("/")
    release_root = f"{prefix}/__releases/{args.release}/" if prefix else f"__releases/{args.release}/"
    production_root = f"{prefix}/" if prefix else ""

    source = f"oss://{bucket}/{release_root}"
    destination = f"oss://{bucket}/{production_root}"
    command = [
        "ossutil",
        "cp",
        "-r",
        source,
        destination,
        "-f",
        "-e",
        endpoint,
        "-i",
        access_key_id,
        "-k",
        access_key_secret,
    ]
    if args.dry_run:
        masked = ["***" if part in {access_key_id, access_key_secret} else part for part in command]
        print("DRY RUN:", " ".join(masked))
        return 0
    subprocess.run(command, check=True)
    print(json.dumps({"rolled_back_to": args.release, "source": source, "destination": destination}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
