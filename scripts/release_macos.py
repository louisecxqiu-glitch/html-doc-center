#!/usr/bin/env python3
"""Build, sign, notarize, staple, and verify the HTML Studio macOS DMG."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_NAME = "HTMLStudio"
DISPLAY_NAME = "HTML Studio"
ENTITLEMENTS = ROOT / "packaging" / "macos" / "entitlements.plist"


def read_version() -> str:
    return (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def validate_version(version: str) -> str:
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError(f"Version must use MAJOR.MINOR.PATCH format: {version!r}")
    return version


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command))
    try:
        return subprocess.run(
            command,
            check=True,
            text=True,
            capture_output=capture,
        )
    except subprocess.CalledProcessError as error:
        if error.stdout:
            print(error.stdout, file=sys.stderr)
        if error.stderr:
            print(error.stderr, file=sys.stderr)
        raise


def find_developer_id() -> str:
    configured = os.environ.get("MACOS_SIGNING_IDENTITY", "").strip()
    if configured:
        return configured

    result = run(
        ["security", "find-identity", "-v", "-p", "codesigning"],
        capture=True,
    )
    matches = sorted(set(re.findall(r'"(Developer ID Application: [^"]+)"', result.stdout)))
    if not matches:
        raise RuntimeError(
            "No Developer ID Application certificate was found in the keychain. "
            "Create and install it first, or set MACOS_SIGNING_IDENTITY."
        )
    if len(matches) > 1:
        raise RuntimeError(
            "Multiple Developer ID Application certificates were found. "
            "Set MACOS_SIGNING_IDENTITY to the exact identity to use."
        )
    return matches[0]


def require_notary_credentials(args: argparse.Namespace) -> tuple[Path, str, str]:
    key = Path(args.api_key).expanduser() if args.api_key else None
    missing = []
    if not key:
        missing.append("APPLE_API_KEY")
    elif not key.is_file():
        raise RuntimeError(f"App Store Connect API key does not exist: {key}")
    if not args.key_id:
        missing.append("APPLE_API_KEY_ID")
    if not args.issuer_id:
        missing.append("APPLE_API_ISSUER_ID")
    if missing:
        raise RuntimeError("Missing notarization credentials: " + ", ".join(missing))
    return key, args.key_id, args.issuer_id


def create_dmg(app_path: Path, dmg_path: Path) -> None:
    stage = ROOT / "build" / "dmg-root"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    shutil.copytree(app_path, stage / app_path.name, symlinks=True)
    (stage / "Applications").symlink_to("/Applications")

    if dmg_path.exists():
        dmg_path.unlink()
    run(
        [
            "hdiutil",
            "create",
            "-volname",
            DISPLAY_NAME,
            "-srcfolder",
            str(stage),
            "-format",
            "UDZO",
            "-ov",
            str(dmg_path),
        ]
    )


def notarize(dmg_path: Path, key: Path, key_id: str, issuer_id: str) -> None:
    result = run(
        [
            "xcrun",
            "notarytool",
            "submit",
            str(dmg_path),
            "--key",
            str(key),
            "--key-id",
            key_id,
            "--issuer",
            issuer_id,
            "--wait",
            "--output-format",
            "json",
        ],
        capture=True,
    )
    notarization_log = ROOT / "dist" / "notarization-result.json"
    notarization_log.write_text(result.stdout, encoding="utf-8")
    response = json.loads(result.stdout)
    if response.get("status") != "Accepted":
        submission_id = response.get("id", "unknown")
        raise RuntimeError(
            f"Apple notarization failed with status {response.get('status')!r}. "
            f"Submission ID: {submission_id}. Details: {notarization_log}"
        )
    print(f"Notarization accepted: {response.get('id')}")


def release(args: argparse.Namespace) -> Path:
    if sys.platform != "darwin":
        raise RuntimeError("The macOS release command must run on macOS.")
    if platform.machine() != "arm64":
        raise RuntimeError("This release is arm64-only and must run on Apple Silicon.")

    version = validate_version(args.version)
    identity = args.identity or find_developer_id()
    if not ENTITLEMENTS.is_file():
        raise RuntimeError(f"Missing entitlements file: {ENTITLEMENTS}")

    build_command = [sys.executable, str(ROOT / "build.py"), "--version", version]
    if identity != "-":
        build_command.extend(["--codesign-identity", identity])
    run(build_command)
    app_path = ROOT / "dist" / f"{APP_NAME}.app"
    executable = app_path / "Contents" / "MacOS" / APP_NAME

    app_sign_command = ["codesign", "--force"]
    if identity != "-":
        app_sign_command.extend(
            [
                "--timestamp",
                "--options",
                "runtime",
                "--entitlements",
                str(ENTITLEMENTS),
            ]
        )
    app_sign_command.extend(["--sign", identity, str(app_path)])
    run(app_sign_command)
    run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app_path)])
    archs = run(["lipo", "-archs", str(executable)], capture=True).stdout.split()
    if archs != ["arm64"]:
        raise RuntimeError(f"Expected an arm64-only executable, got: {archs}")

    suffix = "-unnotarized" if args.skip_notarization else ""
    dmg_path = ROOT / "dist" / f"{APP_NAME}-{version}-macos-arm64{suffix}.dmg"
    create_dmg(app_path, dmg_path)
    dmg_sign_command = ["codesign", "--force"]
    if identity != "-":
        dmg_sign_command.append("--timestamp")
    dmg_sign_command.extend(["--sign", identity, str(dmg_path)])
    run(dmg_sign_command)
    run(["codesign", "--verify", "--verbose=2", str(dmg_path)])

    if args.skip_notarization:
        print("Skipping notarization and Gatekeeper validation by request.")
        return dmg_path

    key, key_id, issuer_id = require_notary_credentials(args)
    notarize(dmg_path, key, key_id, issuer_id)
    run(["xcrun", "stapler", "staple", "-v", str(dmg_path)])
    run(["xcrun", "stapler", "validate", "-v", str(dmg_path)])
    run(
        [
            "spctl",
            "--assess",
            "--type",
            "open",
            "--context",
            "context:primary-signature",
            "--verbose=4",
            str(dmg_path),
        ]
    )
    print(f"Release ready: {dmg_path}")
    return dmg_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=read_version())
    parser.add_argument("--identity", default=os.environ.get("MACOS_SIGNING_IDENTITY"))
    parser.add_argument("--api-key", default=os.environ.get("APPLE_API_KEY"))
    parser.add_argument("--key-id", default=os.environ.get("APPLE_API_KEY_ID"))
    parser.add_argument("--issuer-id", default=os.environ.get("APPLE_API_ISSUER_ID"))
    parser.add_argument(
        "--skip-notarization",
        action="store_true",
        help="Create a signed DMG without sending it to Apple (development only)",
    )
    return parser.parse_args()


def main() -> None:
    try:
        release(parse_args())
    except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Release failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
