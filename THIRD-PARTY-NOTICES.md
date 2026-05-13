# Third-Party Notices

HTML Doc Center makes use of the following third-party software. Their respective licenses are reproduced below.

---

## 1. marked

- **Version**: 11.2.0
- **License**: MIT
- **Homepage**: https://github.com/markedjs/marked
- **Copyright**: Copyright (c) 2011-2024, Christopher Jeffrey
- **Location in this project**: `web/vendor/marked.min.js`
- **Used for**: Rendering `CHANGELOG.md` and `.md` files in the editor

### MIT License (marked)

```
Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/)
Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## 2. aiohttp

- **License**: Apache License 2.0
- **Homepage**: https://github.com/aio-libs/aiohttp
- **Used for**: Async HTTP server (required at runtime via `pip install aiohttp`)
- **Note**: Not bundled; users install separately via pip

---

## 3. playwright (development only)

- **License**: Apache License 2.0
- **Homepage**: https://github.com/microsoft/playwright-python
- **Used for**: Automated screenshot generation (`docs/screenshots/take_screenshots.py`)
- **Note**: Development-only dependency. Not required to run DocCenter.

---

## Python Standard Library

The following modules from the Python standard library are used:
`json`, `os`, `re`, `sys`, `time`, `shutil`, `subprocess`, `platform`, `pathlib`, `datetime`, `asyncio`

These are distributed under the [PSF License](https://docs.python.org/3/license.html) and are not listed individually here.

---

## Originality Statement

All other code in this repository (server.py, saver-runtime.js, web/app.js, web/style.css, etc.) is original work authored by Louis Qiu and contributors, released under the MIT License (see [LICENSE](LICENSE)).

No copying, adaptation, or derivation from other projects beyond the libraries listed above.
