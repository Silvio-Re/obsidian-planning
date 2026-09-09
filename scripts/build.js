// scripts/build.js - Bundle source files into planning.md
// This script reads all source files and combines them into a single
// dataviewjs code block in planning.md

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

for (const file of SRC_FILES) {
  const filePath = path.join(PROJECT_ROOT, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    code += content + '\n\n';
    console.log(`  ✓ ${file}`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
    hasError = true;
  }
}

if (hasError) {
  console.error('Build failed due to errors');
  process.exit(1);
}

// Wrap in dataviewjs code block
const dataviewjs = `\`\`\`dataviewjs\n${code}\`\`\`\n`;

// Write output
try {
  fs.writeFileSync(OUTPUT_FILE, dataviewjs);
  console.log(`\n✅ Built ${OUTPUT_FILE} (${dataviewjs.length} bytes)`);
  
  // Verify the file was created
  const outputContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
  if (outputContent === dataviewjs) {
    console.log('✅ Output file verified');
  } else {
    console.error('✗ Output file content mismatch');
    process.exit(1);
  }
} catch (err) {
  console.error(`✗ Failed to write ${OUTPUT_FILE}: ${err.message}`);
  process.exit(1);
}
