#!/bin/bash
# 启动 DocCenter on AnyDev (port 9901, bind 0.0.0.0)
cd /workspace/html-doc-center
exec python3.12 server.py --host 0.0.0.0 --port 9901 --no-open-browser
