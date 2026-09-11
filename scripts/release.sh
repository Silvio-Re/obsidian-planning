#!/usr/bin/env bash
# scripts/release.sh — Create a proper GitHub release with planning.md asset
# Usage:
#   bash scripts/release.sh <version>
#   bash scripts/release.sh 0.2       (two-part: X.Y)
#   bash scripts/release.sh 0.2.0     (three-part: X.Y.Z)
#
# This script:
#   1. Runs all tests
#   2. Builds planning.md from modular sources
#   3. Commits and pushes the regenerated planning.md
#   4. Creates a GitHub release with planning.md as asset
#
# Naming conventions (enforced):
#   - Tag:          vX.Y or vX.Y.Z
#   - Release name: vX.Y.Z — <short-title>
#   - Commit msg:   vX.Y.Z: <description>
#   - Release notes: .github/release-notes.md (use the template)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Arguments ---
VERSION="${1:?Usage: bash scripts/release.sh <version>  (e.g. 0.2 or 0.2.0)}"
TAG="v${VERSION}"

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

# --- Step 3: Commit regenerated planning.md ---
echo ""
echo "3/4  Committing regenerated planning.md..."
git add planning.md
UNSTAGED=$(git status --porcelain | wc -l)
if [ "$UNSTAGED" -gt 0 ]; then
  echo "   Working tree still dirty after build — commit source changes first."
  exit 1
fi
git commit -m "chore: regenerate planning.md for $TAG" > /dev/null 2>&1
git push origin main > /dev/null 2>&1
echo "   ✓ planning.md committed and pushed"

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
RELEASE_URL=$(gh release view "$TAG" --json url -q '.url' 2>/dev/null || echo "https://github.com/Silvio-Re/obsidian-planning/releases/tag/$TAG")
echo "  $RELEASE_URL"
echo "════════════════════════════════════════"
echo ""
echo "Done. The release script handles everything."
