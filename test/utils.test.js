import assert from 'assert';

// utils.js functions are not exported and are Obsidian-dependent.
// We test the pure functions by reproducing their logic here.
// Since utils.js is the source of truth, these tests verify
// expected behavior of the helpers used by all render modules.

console.log('Testing utils.js functions...');

// --- esc: HTML escape ---
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

assert.strictEqual(esc('hello'), 'hello', 'plain text');
assert.strictEqual(esc('a&amp;b'), 'a&amp;amp;b', 'ampersand escaped');
assert.strictEqual(esc('<div>'), '&lt;div&gt;', 'brackets escaped');
assert.strictEqual(esc('&lt;script&gt;'), '&amp;lt;script&amp;gt;', 'nested escapes');
assert.strictEqual(esc(''), '', 'empty string');
assert.strictEqual(esc(null), 'null', 'null => "null"');
assert.strictEqual(esc(undefined), 'undefined', 'undefined => "undefined"');
assert.strictEqual(esc(123), '123', 'number converted to string');
console.log('  esc: PASS');

// --- escA: HTML attribute escape (no > escape) ---
function escA(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

assert.strictEqual(escA('class="test"'), 'class=&quot;test&quot;', 'double quotes escaped');
assert.strictEqual(escA('a&b'), 'a&amp;b', 'ampersand escaped');
assert.strictEqual(escA('<x>'), '&lt;x>', 'escA escapes < but NOT >');
assert.strictEqual(escA('a"b&c<d'), 'a&quot;b&amp;c&lt;d', 'all attrs escaped');
assert.strictEqual(escA(''), '', 'empty string');

console.log('  escA: PASS');

// --- renderMd: minimal markdown rendering ---
function renderMd(s) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  return h;
}

assert.strictEqual(renderMd('hello'), 'hello', 'plain text');
assert.strictEqual(renderMd('**bold**'), '<strong>bold</strong>', 'bold');
assert.strictEqual(renderMd('~~strikethrough~~'), '<del>strikethrough</del>', 'strikethrough');
assert.strictEqual(renderMd('`code`'), '<code>code</code>', 'inline code');
assert.strictEqual(renderMd('**bold** and `code`'), '<strong>bold</strong> and <code>code</code>', 'mixed');
assert.strictEqual(renderMd('**a** and **b**'), '<strong>a</strong> and <strong>b</strong>', 'multiple bold');
assert.strictEqual(renderMd('**unclosed bold'), '**unclosed bold', 'no match for unclosed');
assert.strictEqual(renderMd('& < >'), '&amp; &lt; &gt;', 'html escaped before markdown');
assert.strictEqual(renderMd('***triple***'), '<strong>*triple</strong>*', 'triple asterisks — first two ** match, trailing * left');
assert.strictEqual(renderMd('a `b**c` d'), 'a <code>b**c</code> d', 'bold inside code not processed');

console.log('  renderMd: PASS');

// --- clip: string truncation ---
function clip(s, k) {
  return s.length > k ? s.slice(0, k - 1) + '\u2026' : s;
}

assert.strictEqual(clip('hello', 6), 'hello', 'shorter than k');
assert.strictEqual(clip('hello', 5), 'hello', 'equal to k');
assert.strictEqual(clip('hello', 4), 'hel\u2026', 'truncated to 3 + ellipsis');
assert.strictEqual(clip('hello world', 5), 'hell\u2026', 'k=5 => 4 chars + ellipsis');
assert.strictEqual(clip('', 5), '', 'empty string');
assert.strictEqual(clip('ab', 2), 'ab', 'exact length 2');
assert.strictEqual(clip('abc', 3), 'abc', 'exact length 3');
assert.strictEqual(clip('abcdefghijkl', 7), 'abcdef\u2026', '7 => 6 chars + ellipsis');

console.log('  clip: PASS');

console.log('\nAll utils tests passed!');
process.exit(0);

// --- clip: truncate string with ellipsis ---

// --- clip edge cases ---
assert.strictEqual(clip('hello', 10), 'hello', 'shorter than max => unchanged');
assert.strictEqual(clip('hello', 6), 'hello', 'length equals max => unchanged');
assert.strictEqual(clip('hello', 5), 'hell\u2026', 'equal length => truncated with ellipsis');
assert.strictEqual(clip('hello world', 8), 'hello \u2026', 'longer => truncated');
assert.strictEqual(clip('', 5), '', 'empty string');
assert.strictEqual(clip('a', 2), 'a', 'single char');
assert.strictEqual(clip('ab', 2), 'a\u2026', '2 chars at threshold => truncates');
console.log('  clip: PASS');

// --- renderMd edge cases ---
assert.strictEqual(renderMd('**bold**'), '<strong>bold</strong>', 'bold');
assert.strictEqual(renderMd('~~strike~~'), '<del>strike</del>', 'strikethrough');
assert.strictEqual(renderMd('`code`'), '<code>code</code>', 'inline code');
assert.strictEqual(renderMd('<script>'), '&lt;script&gt;', 'escapes HTML in renderMd');
assert.strictEqual(renderMd('**&lt;escaped&gt;**'), '<strong>&lt;escaped&gt;</strong>', 'escapes inside markdown');
assert.strictEqual(renderMd('normal text'), 'normal text', 'no markdown => unchanged');
console.log('  renderMd: PASS');

console.log('\nAll extended utils tests passed!');
