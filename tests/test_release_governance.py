from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_release_version_and_verifier_are_present():
    assert read("VERSION").strip() == "2.7.0"
    verifier = ROOT / "scripts" / "verify_release.py"
    assert verifier.is_file()
    assert "VERSION" in verifier.read_text(encoding="utf-8")
    assert "release-oss.yml" in verifier.read_text(encoding="utf-8")


def test_ci_runs_for_pull_requests_and_main_without_release_credentials():
    ci = read(".github/workflows/ci.yml")
    assert "pull_request:" in ci
    assert "main" in ci
    assert "pytest" in ci
    assert "pytest-asyncio" in ci
    assert "compileall" in ci
    assert "verify_release.py --check" in ci
    assert "MACOS_CERTIFICATE" not in ci
    assert "APPLE_API_KEY" not in ci


def test_release_is_tag_only_uses_protected_environment_and_checksums():
    release = read(".github/workflows/release-oss.yml")
    assert "tags:" in release
    assert "- 'v*'" in release
    assert "workflow_dispatch" not in release
    assert "environment: desktop-release" in release
    assert "test \"v${VERSION}\" = \"${GITHUB_REF_NAME}\"" in release
    assert "SHA256SUMS.txt" in release
    assert "notarytool" in read("scripts/release_macos.py")


def test_windows_release_uses_powershell_compatible_version_handling():
    release = read(".github/workflows/release-oss.yml")
    macos_job, windows_job = release.split("  build-windows:", maxsplit=1)
    assert "shell: bash" in macos_job
    assert 'python3 scripts/verify_release.py --check --expected-tag "${GITHUB_REF_NAME}"' in macos_job
    assert "shell: pwsh" in windows_job
    assert "Get-Content VERSION -Raw" in windows_job
    assert 'python build.py --version $version' in windows_job
