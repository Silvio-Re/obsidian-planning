// scripts/build.js - Bundle source files into markdown release files.
// This script reads source files, resolves ES module imports, and combines them into a single
// flat file wrapped in a `dataviewjs` code block. It can produce several artifacts (each a
// separate dataviewjs entry for a different note): planning.md (the dashboard) and daily.md
// (the daily-note "completed today" view). Each artifact is a self-contained bundle.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// Package version, read from package.json so the release files stay in sync
const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version || '0.0.0';

// Entry points, in dependency order, per release artifact. `planning.js` is the dashboard entry;
// `daily_notes.js` is the daily-note entry. Both share constants.js / utils.js / parser.js (the
// latter via the shared extractCompletedTask helper) so parsing stays DRY across artifacts.
const ARTIFACTS = {
  'planning.md': {
    files: [
      'src/config.js',
      'src/constants.js',
      'src/utils.js',
      'src/render_model.js',
      'src/parser.js',
      'src/scheduler.js',
      'src/capacity.js',
      'src/agenda.js',
      'src/render/agenda.js',
      'src/risk.js',
      'src/render/risk.js',
      'src/render/capacity_chart.js',
      'src/render/gantt.js',
      'src/render/execution_list.js',
      'src/render/ignored.js',
      'src/render/parsing_errors.js',
      'src/render/completed.js',
      'src/execution_sequence.js',
      'src/index.js',
    ],
  },
  'daily.md': {
    files: [
      'src/config.js',
      'src/constants.js',
      'src/utils.js',
      'src/render_model.js',
      'src/parser.js',
      'src/render/completed.js',
      'src/render/daily_notes.js',
      'src/daily_notes.js',
    ],
  },
};

console.log(`Building ${Object.keys(ARTIFACTS).join(' & ')} from source files...`);

// Read every file for an artifact, returning { fileContents, hasError }. Missing files are
// reported per-file; the caller aborts the whole build if any are missing.
function readAll(files) {
  const fileContents = {};
  let hasError = false;
  for (const file of files) {
    const filePath = path.join(PROJECT_ROOT, file);
    try {
      fileContents[file] = fs.readFileSync(filePath, 'utf8');
      console.log(`  ${file}`);
    } catch (err) {
      console.error(`  ERROR ${file}: ${err.message}`);
      hasError = true;
    }
  }
  return { fileContents, hasError };
}

// Resolve imports and inline dependencies across `files` into one flat string. `processed` and
// `declaredIdentifiers` are local to each bundle so deduplication is per-artifact (artifacts share
// source files but must not dedupe declarations across one another).
function bundle(fileContents, files) {
  const processed = new Set();
  const declaredIdentifiers = new Set();

  function resolveImports(filePath) {
    const relPath = path.relative(PROJECT_ROOT, filePath);

    if (processed.has(relPath)) {
      return '';
    }
    processed.add(relPath);

    let content = fileContents[relPath];

    // Remove all import/export statements and replace with actual code
    const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]\s*;/g;

    let result = '';
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const fromFile = match[2];
      const fromPath = path.join(path.dirname(relPath), fromFile);
      const fromRelPath = path.relative(PROJECT_ROOT, fromPath);

      if (!processed.has(fromRelPath)) {
        result += resolveImports(fromPath);
      }
    }

    // Remove export/import statements — LINE-ANCHORED ONLY. A mid-line pass
    // (/export\s+/g) would rewrite the word "export" inside string literals and
    // comments (e.g. a tooltip 'export this report' became 'this report'), silently
    // corrupting behavior. Every src/ import/export starts at column 0, so the
    // anchored patterns cover them all; validate.mjs then fails the build if any
    // import/export statement survives (a leftover would also break the bundle's syntax).
    content = content.replace(/^export\s+/gm, '');
    content = content.replace(/^import[^\n]*;\s*$/gm, '');

    // Deduplicate const/let/var declarations
    const lines = content.split('\n');
    const filteredLines = [];

    for (const line of lines) {
      const lineDeclMatch = line.match(/^(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/);
      if (lineDeclMatch) {
        const name = lineDeclMatch[2];
        if (declaredIdentifiers.has(name) && !line.trim().startsWith('//')) {
          continue;
        }
        declaredIdentifiers.add(name);
      }
      filteredLines.push(line);
    }

    content = filteredLines.join('\n');
    result += content + '\n\n';

    return result;
  }

  const outputParts = [];
  for (const file of files) {
    const filePath = path.join(PROJECT_ROOT, file);
    const resolved = resolveImports(filePath);
    if (resolved) {
      outputParts.push(resolved);
    }
  }

  return outputParts.join('\n');
}

// Wrap `code` in the dataviewjs fence (stamped with the package version) and write to `output`.
// Verifies the written bytes match so a silent write failure is caught here, not in Obsidian.
function writeBundle(output, code, version) {
  const header = `// obsidian-planning v${version} - generated by scripts/build.js - do not edit by hand\n`;
  const dataviewjs = `\`\`\`dataviewjs\n${header}${code}\`\`\`\n`;

  const outPath = path.join(PROJECT_ROOT, output);
  fs.writeFileSync(outPath, dataviewjs);
  const outputContent = fs.readFileSync(outPath, 'utf8');
  if (outputContent !== dataviewjs) {
    throw new Error(` Output file content mismatch (${outPath})`);
  }
  console.log(`  Built ${output} (${Buffer.byteLength(dataviewjs, 'utf8')} bytes)`);
  console.log('  Output file verified');
}

let hasError = false;
for (const [output, { files }] of Object.entries(ARTIFACTS)) {
  const { fileContents, hasError: readErr } = readAll(files);
  if (readErr) {
    hasError = true;
    continue;
  }
  try {
    const code = bundle(fileContents, files);
    writeBundle(output, code, VERSION);
  } catch (err) {
    console.error(`  ERROR building ${output}: ${err.message}`);
    hasError = true;
  }
}

if (hasError) {
  console.error('Build failed due to errors');
  process.exit(1);
}
