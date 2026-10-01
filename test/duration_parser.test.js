// Unit tests for duration parser
// Tests the regex pattern that supports both:
// - (⏱:: 24h) - original format with parentheses and ::
// - ⏱ 24h   - new format without parentheses and ::

// Use a regex literal to properly include the ⏱ character
// Note: In regex literals, we use ( and ) for groups, not \( and \)
const clock = '\u23f1';
import { durRe, ownDur } from '../src/constants.js';

// Test cases - use the clock variable to ensure we have the actual ⏱ character
const tests = [
    // Original format with parentheses
    { input: '(' + clock + ':: 24h) some task', expected: 24, desc: 'original: with parens and ::' },
    { input: '(' + clock + ':: 2h)', expected: 2, desc: 'original: with parens, single digit' },
    { input: '(' + clock + ':: 0.5h)', expected: 0.5, desc: 'original: with parens, decimal < 1' },
    { input: '(' + clock + ':: 1.5h)', expected: 1.5, desc: 'original: with parens, decimal > 1' },
    { input: '(' + clock + ':: 10h)', expected: 10, desc: 'original: with parens, double digit' },
    // New format without parentheses
    { input: clock + ' 24h some task', expected: 24, desc: 'new: without parens, integer hours' },
    { input: clock + ' 2h', expected: 2, desc: 'new: without parens, single digit' },
    { input: clock + ' 0.5h', expected: 0.5, desc: 'new: without parens, decimal < 1' },
    { input: clock + ' 1.5h', expected: 1.5, desc: 'new: without parens, decimal > 1' },
    { input: clock + ' 10h', expected: 10, desc: 'new: without parens, double digit' },
    // Edge cases
    { input: 'no duration here', expected: 0, desc: 'no duration' },
];

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log('Running duration parser tests...\n');
    console.log('Regex source:', durRe.source);
    console.log();

    tests.forEach((test, index) => {
        const result = ownDur({ text: test.input });
        const status = result === test.expected ? 'PASS' : 'FAIL';

        if (status === 'PASS') {
            passed++;
            console.log(`✓ Test ${index + 1}: ${status} - ${test.desc}`);
        } else {
            failed++;
            console.log(`✗ Test ${index + 1}: ${status} - ${test.desc}`);
            console.log(`  Input: "${test.input}"`);
            console.log(`  Expected: ${test.expected}`);
            console.log(`  Got: ${result}`);
            const dm = test.input.match(durRe);
            console.log(`  Match: ${dm ? JSON.stringify(dm) : 'null'}`);
        }
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    return failed === 0;
}

const success = runTests();
process.exit(success ? 0 : 1);
