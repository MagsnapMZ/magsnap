#!/usr/bin/env python3
"""Prepare the static MAGSNAP site for OSS deployment."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


EXCLUDED_DIRS = {
    ".git",
    ".github",
    ".pytest_cache",
    "__pycache__",
    "backups",
    "deployment-artifacts",
    "dist",
    "node_modules",
    "playwright-recordings",
    "scripts",
    "supabase",
    "tests",
}

EXCLUDED_FILES = {
    ".DS_Store",
    ".gitignore",
    "CNAME",
    "FOUNDER_REGISTRY_SETUP.md",
    "MAGSNAP_ALIGNMENT_MAP.md",
    "MAGSNAP_SOURCE_OF_TRUTH.md",
    "README.md",
    "deployment_live_check.json",
    "deployment_report.md",
    "deployment_static_check.json",
    "index_v1_backup.html",
    "mobile_story_preview.png",
    "project-context.xml",
    "website_redesign_brief.md",
}

EXCLUDED_SUFFIXES = {
    ".log",
    ".md",
    ".py",
    ".sql",
    ".xlsx",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def should_skip(path: Path, source: Path) -> bool:
    relative = path.relative_to(source)
    if any(part in EXCLUDED_DIRS for part in relative.parts[:-1]):
        return True
    if path.name in EXCLUDED_FILES:
        return True
    if path.suffix in EXCLUDED_SUFFIXES:
        return True
    if path.name.startswith("preview-") and path.suffix == ".png":
        return True
    if path.name.startswith(".") and path.name not in {".nojekyll"}:
        return True
    return False


def copy_site(source: Path, output: Path) -> dict[str, object]:
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    files: list[dict[str, object]] = []
    for path in sorted(source.rglob("*")):
        if not path.is_file() or should_skip(path, source):
            continue
        relative = path.relative_to(source)
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        files.append(
            {
                "path": relative.as_posix(),
                "bytes": target.stat().st_size,
                "sha256": sha256(target),
            }
        )

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(files),
        "total_bytes": sum(int(item["bytes"]) for item in files),
        "files": files,
    }
    manifest_path = output / "deployment_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare static files for Aliyun OSS deployment.")
    parser.add_argument("--source", default=".", help="Repository root.")
    parser.add_argument("--output", default="dist", help="Output directory.")
    args = parser.parse_args()

    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    manifest = copy_site(source, output)
    print(json.dumps({"output": str(output), "file_count": manifest["file_count"], "total_bytes": manifest["total_bytes"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
