"""Static contracts for workspace scoping and context affordances."""

from pathlib import Path


APP = Path("web/app.js").read_text(encoding="utf-8")
INDEX = Path("web/index.html").read_text(encoding="utf-8")
STYLE = Path("web/style.css").read_text(encoding="utf-8")
EN = Path("web/locales/en.js").read_text(encoding="utf-8")
ZH = Path("web/locales/zh.js").read_text(encoding="utf-8")
README = Path("README.md").read_text(encoding="utf-8")


def test_workspace_scope_contract_is_present():
    assert 'id="workspace-scope"' in INDEX
    assert "WORKSPACE_SCOPE_KEY" in APP
    assert "getDisplayRoots" in APP
    assert "findWorkspaceForPath" in APP
    assert 'id="workspace-context"' in INDEX
    assert 'id="scan-overlap-hint"' in INDEX
    assert "workspace.scope.all" in EN and "workspace.scope.all" in ZH
    assert ".workspace-scope" in STYLE


def test_workspace_root_path_keeps_directory_boundary_semantics():
    assert 'if (r === "/") return p.startsWith("/");' in APP


def test_readme_uses_supported_server_command():
    assert "python3 server.py --dev" not in README
    assert "python3 server.py --no-open-browser" in README
