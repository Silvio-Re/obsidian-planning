#!/usr/bin/env bash
# scripts/release.sh — Create a proper GitHub release with planning.md asset
# Usage:
#   bash scripts/release.sh <version>
#   bash scripts/release.sh 0.3
#
# This script:
#   1. Verifies all tests pass
#   2. Builds planning.md
#   3. Creates a GitHub release with planning.md as asset
#   4. Tags the release and pushes
#
# Naming conventions (enforced):
#   - Tag:          vX.Y.Z  (e.g. v0.3)
#   - Release name: vX.Y.Z — <short-title>
#   - Commit msg:   vX.Y.Z: <description>
#   - Release notes: .github/release-notes.md (use the template)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Arguments ---
VERSION="${1:?Usage: bash scripts/release.sh <version>  (e.g. 0.3)}"
TAG="v${VERSION}"

# --- Validate version format ---
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Version must be X.Y.Z format (got: $VERSION)"
  exit 1
fi

# --- Step 1: Run tests ---
echo "════════════════════════════════════════"
echo "  obsidian-planning release — $TAG"
echo "════════════════════════════════════════"
echo ""
echo "1/4  Running tests..."
npm test
echo "   ✓ All tests passed"

# --- Step 2: Build planning.md ---
echo ""
echo "2/4  Building planning.md..."
npm run build
echo "   ✓ planning.md built"

# --- Step 3: Check git state ---
echo ""
echo "3/4  Checking git state..."
UNSTAGED=$(git status --porcelain | wc -l)
if [ "$UNSTAGED" -gt 0 ]; then
  echo "ERROR: Working tree is dirty. Commit staged changes first."
  echo "   Run: git add -A && git commit -m \"${TAG}: <description>\""
  exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: Must be on 'main' branch (currently on '$CURRENT_BRANCH')"
  exit 1
fi

# --- Step 4: Create GitHub release ---
echo ""
echo "4/4  Creating release $TAG..."

NOTES_FILE="$ROOT_DIR/.github/release-notes.md"
if [ ! -f "$NOTES_FILE" ]; then
  echo "ERROR: $NOTES_FILE not found."
  echo "   Create it using .github/release-notes.md.template as a starting point."
  exit 1
fi

# Delete existing release if it exists (idempotent)
if gh release view "$TAG" &>/dev/null; then
  echo "   Release $TAG already exists — deleting first..."
  gh release delete "$TAG" --yes
fi

# Create release with planning.md asset
gh release create "$TAG" \
  --title "$TAG — $(head -1 "$NOTES_FILE" | sed 's/^## //')" \
  --notes-file "$NOTES_FILE" \
  planning.md

echo ""
echo "════════════════════════════════════════"
echo "  ✓ Release created!"
echo "  $TAG"
echo "  $(gh release view "$TAG" --json url -q '.url' 2>/dev/null || echo 'https://github.com/Silvio-Re/obsidian-planning/releases/tag/'$TAG)"
echo "════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  git add .github/release-notes.md  # if you updated notes"
echo "  git commit -m \"$TAG: release notes\""
echo "  git push origin main"
