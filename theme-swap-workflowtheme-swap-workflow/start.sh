#!/bin/bash
# Theme Swap Workflow — 一键启动
# 用法: bash start.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Theme Swap Workflow                    ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Starting...                             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 启动服务
node server.js
