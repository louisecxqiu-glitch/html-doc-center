"""Static contract checks for the Markdown editor's WeChat mode."""

from pathlib import Path


MD_EDITOR = Path("web/md-editor.html").read_text(encoding="utf-8")


def test_wechat_mode_contract_is_present():
    assert 'data-view="wechat"' in MD_EDITOR
    assert "wechat-preview-frame" in MD_EDITOR
    assert "复制 HTML" in MD_EDITOR
    assert "导出 HTML" in MD_EDITOR
    assert "__MD_WECHAT_CTL__" in MD_EDITOR


def test_wechat_mode_uses_local_format_endpoint_and_rich_clipboard():
    assert "/api/wechat/format" in MD_EDITOR
    assert "ClipboardItem" in MD_EDITOR
    assert "text/html" in MD_EDITOR
    assert "URL.createObjectURL" in MD_EDITOR
    assert '#wechat-preview-frame { display: block; }' in MD_EDITOR
    assert "fallbackCopyText(wechatState.html)" in MD_EDITOR
    assert '.md-wechat-actions[hidden] { display: none; }' in MD_EDITOR
