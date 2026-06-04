# /hotpage — Open HTML in HotPage

Open any HTML file in the local HotPage document workbench for live editing, annotation, and auto-saving.

## Usage

```
/hotpage [path]          Open a specific HTML file
/hotpage serve [dir]     Start HotPage serving a directory
/hotpage stop            Stop the HotPage server
```

## Examples

- `/hotpage ./reports/q1-summary.html` — Open a report for editing
- `/hotpage serve ./outputs` — Serve all HTML files in outputs/
- `/hotpage` — Open HotPage dashboard (lists all discovered HTML files)

## What it does

1. Starts the HotPage local server (if not running)
2. Opens the specified file in HotPage's browser-based editor
3. Auto-saves edits (2s idle → snapshot, close → overwrite/save-as/discard)
4. All files stay local — nothing leaves your machine
