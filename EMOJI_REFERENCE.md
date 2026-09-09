# Emoji Reference (DO NOT EDIT)

This file defines the exact emoji used in parsing.
**AI MUST use the escape sequences below. NEVER type emoji directly or interpret them.**

All emoji MUST be represented using the format: `\u{XXXXXX}` where XXXXXX is the 6-digit hexadecimal code point.

| Name | Code Point | Escape Sequence | Usage |
|------|------------|------------------|-------|
| Priority 0 (Highest) | U+1F53A | `\u{1F53A}` | Highest priority task |
| Priority 1 | U+23EB | `\u{23EB}` | High priority |
| Priority 2 (Default) | U+1F53C | `\u{1F53C}` | Medium priority |
| Priority 3 | U+1F53D | `\u{1F53D}` | Low priority |
| Priority 4 (Lowest) | U+23EC | `\u{23EC}` | Lowest priority |
| Clock | U+23F1 | `\u{23F1}` | Duration marker |
| Calendar | U+1F4C5 | `\u{1F4C5}` | Date marker |
| ID | U+1F194 | `\u{1F194}` | Task ID marker |
| Block | U+26D4 | `\u{26D4}` | Block/dependency marker |

> WARNING: AI must NEVER use literal emoji characters or \uXXXX (4-digit) surrogate pairs.
> ONLY use \u{XXXXXX} format for all emoji.
