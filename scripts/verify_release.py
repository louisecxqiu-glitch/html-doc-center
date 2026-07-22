#!/usr/bin/env python3
"""Validate the repository metadata required for an HTML Studio release.

This command intentionally performs no signing, packaging, or network I/O. It
is safe for pull-request CI and prevents a tag from reaching credentialed
release jobs with an inconsistent version or workflow contract.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEMVER = re.compile(r"\d+\.\d+\.\d+\Z")


def read(relative_path: str) -> str:
    path = ROOT / relative_path
    if not path.is_file():
        raise ValueError(f"Required release file is missing: {relative_path}")
    return path.read_text(encoding="utf-8")


def require(contents: str, needle: str, description: str) -> None:
    if needle not in contents:
        raise ValueError(f"Release contract missing {description}: {needle!r}")


def validate(expected_tag: str | None = None) -> str:
    version = read("VERSION").strip()
    if not SEMVER.fullmatch(version):
        raise ValueError(f"VERSION must use MAJOR.MINOR.PATCH: {version!r}")
    if expected_tag and expected_tag != f"v{version}":
        raise ValueError(
            f"Tag/version mismatch: expected v{version}, received {expected_tag}"
        )

    ci = read(".github/workflows/ci.yml")
    require(ci, "pull_request:", "Pull Request trigger")
    require(ci, "main", "main branch trigger")
    require(ci, "python3 -m pytest -q", "pytest check")
    require(ci, "python3 -m compileall -q", "Python compilation check")
    require(ci, "python3 scripts/verify_release.py --check", "release contract check")
    for credential in ("MACOS_CERTIFICATE", "APPLE_API_KEY"):
        if credential in ci:
            raise ValueError(f"CI must not reference release credential {credential}")

    release = read(".github/workflows/release-oss.yml")
    require(release, "tags:", "tag trigger")
    require(release, "- 'v*'", "v* tag filter")
    require(release, "environment: desktop-release", "protected release environment")
    require(release, 'test "v${VERSION}" = "${GITHUB_REF_NAME}"', "Tag/version check")
    require(release, "SHA256SUMS.txt", "release checksum asset")
    if "workflow_dispatch" in release:
        raise ValueError("Release workflow must only run from a version tag")

    for relative_path in (
        "build.py",
        "scripts/release_macos.py",
        "requirements-build.txt",
        "packaging/macos/entitlements.plist",
    ):
        read(relative_path)
    return version


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate release metadata")
    parser.add_argument("--expected-tag", help="require VERSION to match this Git tag")
    args = parser.parse_args()
    if not args.check:
        parser.error("--check is required")
    try:
        version = validate(args.expected_tag)
    except ValueError as error:
        print(f"Release check failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(f"Release check passed for v{version}")


if __name__ == "__main__":
    main()
