#!/usr/bin/env bash
set -euo pipefail

REPO="${TESTKIT_REPO:-raintr91/Testkit}"
INSTALL_DIR="${TESTKIT_INSTALL_DIR:-$HOME/.testkit}"
BIN_DIR="${TESTKIT_BIN_DIR:-$HOME/.local/bin}"
REF="${TESTKIT_REF:-v0.2.4}"

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$BIN_DIR/testkit" "$BIN_DIR/testkit-mcp"
  rm -rf "$INSTALL_DIR"
  echo "testkit uninstalled."
  exit 0
fi

command -v node >/dev/null || { echo "testkit: Node.js >=22 required" >&2; exit 1; }
command -v git >/dev/null || { echo "testkit: git required" >&2; exit 1; }

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
git clone --depth 1 --branch "$REF" "https://github.com/$REPO.git" "$tmpdir/src"
rm -rf "$INSTALL_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")"
mv "$tmpdir/src" "$INSTALL_DIR"
cd "$INSTALL_DIR"

if command -v pnpm >/dev/null; then
  pnpm install --frozen-lockfile
  pnpm build
else
  npm ci
  npm run build
fi

mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/testkit.mjs" "$BIN_DIR/testkit"
ln -sf "$INSTALL_DIR/bin/testkit-mcp.mjs" "$BIN_DIR/testkit-mcp"
chmod +x "$INSTALL_DIR/bin/"*.mjs

echo "Installed Testkit. Next:"
echo "  testkit init --type=tests --yes"
