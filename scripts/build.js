// scripts/build.js - Bundle source files into planning.md
// This script reads all source files, resolves ES module imports,
// and combines them into a single flat file wrapped in dataviewjs code block

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// List of source files in order they should be concatenated
const SRC_FILES = [
  'src/constants.js',
  'src/parser.js',
  'src/scheduler.js',
  'src/capacity.js',
  'src/render/capacity_chart.js',
  'src/render/gantt.js',
  'src/render/execution_list.js',
  'src/render/ignored.js',
  'src/render/parsing_errors.js',
  'src/index.js',
];

const OUTPUT_FILE = path.join(PROJECT_ROOT, 'planning.md');

console.log('Building planning.md from source files...');

let code = '';
let hasError = false;

// First pass: read all files
const fileContents = {};
for (const file of SRC_FILES) {
  const filePath = path.join(PROJECT_ROOT, file);
  try {
    fileContents[file] = fs.readFileSync(filePath, 'utf8');
    console.log(`  [32m[1m[22m[39m ${file}`);
  } catch (err) {
    console.error(`  [31m[1m[22m[39m ${file}: ${err.message}`);
    hasError = true;
  }
}

if (hasError) {
  console.error('Build failed due to errors');
  process.exit(1);
}

// Second pass: resolve imports and inline dependencies
// We need to process files in order and replace imports with actual code
const processed = new Set();
const outputParts = [];

function resolveImports(filePath, indent = 0) {
  const relPath = path.relative(PROJECT_ROOT, filePath);
  
  if (processed.has(relPath)) {
    return ''; // Already processed, skip to avoid duplicates
  }
  processed.add(relPath);
  
  let content = fileContents[relPath];
  
  // Remove all import/export statements and replace with actual code
  // Match: import { ... } from 'path';
  const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]\s*;/g;
  
  let result = '';
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1].split(',').map(i => i.trim());
    const fromFile = match[2];
    const fromPath = path.join(path.dirname(relPath), fromFile);
    const fromRelPath = path.relative(PROJECT_ROOT, fromPath);
    
    // Add the content from the imported file (if not already added)
    if (!processed.has(fromRelPath)) {
      result += resolveImports(fromPath, indent);
    }
    
    // Skip the import statement - we've inlined the content
  }
  
  // Remove export statements
  content = content.replace(/^export\s+/gm, '');
  content = content.replace(/export\s+/g, '');
  
  // Remove import statements (we've already processed them)
  content = content.replace(/^import\s+.*?\s*;\s*$/gm, '');
  content = content.replace(/import\s+.*?\s*;/g, '');
  
  // Add the processed content
  result += content + '\n\n';
  
  return result;
}

// Process all files in order
for (const file of SRC_FILES) {
  const filePath = path.join(PROJECT_ROOT, file);
  const resolved = resolveImports(filePath);
  if (resolved) {
    outputParts.push(resolved);
  }
}

code = outputParts.join('\n');

// Wrap in dataviewjs code block
const dataviewjs = `\`\`\`dataviewjs\n${code}\`\`\`\n`;

// Write output
try {
  fs.writeFileSync(OUTPUT_FILE, dataviewjs);
  console.log(`\n[32m[1m[22m[39m Built ${OUTPUT_FILE} (${Buffer.byteLength(dataviewjs, 'utf8')} bytes)`);
  
  // Verify the file was created
  const outputContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
  if (outputContent === dataviewjs) {
    console.log('[32m[1m[22m[39m Output file verified');
  } else {
    console.error('[31m[1m[22m[39m Output file content mismatch');
    process.exit(1);
  }
} catch (err) {
  console.error(`[31m[1m[22m[39m Failed to write ${OUTPUT_FILE}: ${err.message}`);
  process.exit(1);
}
