import argparse
import importlib.util
import plistlib
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


build = load_module("htmlstudio_build", ROOT / "build.py")
release_macos = load_module("release_macos", ROOT / "scripts" / "release_macos.py")


def test_release_version_is_semantic_version():
    version = build.read_version()
    assert version == "2.7.0"
    assert release_macos.validate_version(version) == version


@pytest.mark.parametrize("version", ["v2.6.0", "2.6", "2.6.0-beta", ""])
def test_release_version_rejects_unsupported_formats(version):
    with pytest.raises(ValueError):
        release_macos.validate_version(version)


def test_macos_entitlements_are_valid_and_minimal():
    with (ROOT / "packaging" / "macos" / "entitlements.plist").open("rb") as handle:
        entitlements = plistlib.load(handle)
    assert entitlements == {"com.apple.security.cs.disable-library-validation": True}


def test_notary_credentials_report_all_missing_values(monkeypatch):
    args = argparse.Namespace(api_key=None, key_id=None, issuer_id=None)
    with pytest.raises(RuntimeError, match="APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER_ID"):
        release_macos.require_notary_credentials(args)
