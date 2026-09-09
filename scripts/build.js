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
  'src/utils.js',
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
    console.log(`  ${file}`);
  } catch (err) {
    console.error(`  ERROR ${file}: ${err.message}`);
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
  
  // Remove export statements
  content = content.replace(/^export\s+/gm, '');
  content = content.replace(/export\s+/g, '');
  
  // Remove import statements
  content = content.replace(/^import\s+.*?\s*;\s*$/gm, '');
  content = content.replace(/import\s+.*?\s*;/g, '');
  
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

try {
  fs.writeFileSync(OUTPUT_FILE, dataviewjs);
  console.log(`\n Built ${OUTPUT_FILE} (${Buffer.byteLength(dataviewjs, 'utf8')} bytes)`);
  
  const outputContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
  if (outputContent === dataviewjs) {
    console.log(' Output file verified');
  } else {
    console.error(' Output file content mismatch');
    process.exit(1);
  }
} catch (err) {
  console.error(` Failed to write ${OUTPUT_FILE}: ${err.message}`);
  process.exit(1);
}
