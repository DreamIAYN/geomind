#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

URL="http://127.0.0.1:4173"
BIN="$PWD/.cloudflared/cloudflared"

if ! curl -fsS --max-time 3 "$URL/api/health" >/dev/null 2>&1; then
  echo "本地服务未运行。请先在另一个终端执行：npm start" >&2
  exit 1
fi

if [ ! -x "$BIN" ]; then
  echo "未找到 cloudflared，正在下载官方 Linux amd64 二进制…" >&2
  mkdir -p .cloudflared
  if ! curl -fL --retry 2 --connect-timeout 15 --max-time 180 \
    -o "$BIN.download" \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64; then
    rm -f "$BIN.download"
    echo "官方地址下载失败。请手动下载 cloudflared-linux-amd64 到 .cloudflared/cloudflared 后重试。" >&2
    exit 1
  fi
  chmod +x "$BIN.download"
  mv "$BIN.download" "$BIN"
fi

echo "Cloudflare Quick Tunnel → $URL" >&2
echo "URL 会打印在下面的日志中；每次重启都会变化。" >&2
exec "$BIN" tunnel --url "$URL" --no-autoupdate
