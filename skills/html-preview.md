# HTML Preview & Edit Skill

When generating HTML files (reports, articles, dashboards, cover images, presentations), automatically open them in HotPage for instant preview and editing.

## Behavior

After generating any `.html` file:
1. Check if HotPage server is running on port 9901
2. If not running, start it with the current workspace as scan root
3. Open the generated file URL: `http://localhost:9901/?path={relative_path}`
4. Inform the user: "Opened in HotPage — you can edit directly in the browser"

## When to activate

- After writing any `.html` file to disk
- When user says "preview", "open", "show me" referring to an HTML file
- After generating covers, reports, presentations in HTML format

## MCP Tools Used

- `hotpage_open`: Open a file in HotPage
- `hotpage_status`: Check if server is running
- `hotpage_serve`: Start serving a directory
