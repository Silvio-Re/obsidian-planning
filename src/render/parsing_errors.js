// src/render/parsing_errors.js - Parsing errors rendering (Obsidian/Dataview dependent)
// This file uses dv and app - not testable outside Obsidian

import { esc, escA, renderMd, makeTaskOpener, openTask } from '../utils.js';

/**
 * Render parsing errors
 * Depends on: dv, app, and warnings list
 */
export function renderParsingErrors(container, warnings) {
  const errDiv = container.createEl('div');
  errDiv.style.cssText = 'font-size:13px;border:1px solid rgba(128,128,0.25);border-radius:6px;overflow:hidden;';

  if (!warnings.length) {
    errDiv.createEl('div', { text: 'No parsing errors found - all task metadata is valid.' })
      .style.cssText = 'padding:5px;color:gray;font-size:12px;text-align:center;';
    return;
  }

  const rows = warnings.map((e, idx) => {
    const errorList = e.errors.map(err => `<span style="color:rgb(224,108,117);font-size:11px;">${esc(err)}</span>`).join(' \u00b7 ');
    return `<div class="prow" data-path="${escA(e.path)}" data-line="${e.line}" style="cursor:pointer;padding:4px 8px;border-bottom:1px solid rgba(128,128,0.15);">
      <span style="color:rgb(255,165,0);font-weight:bold;min-width:24px;display:inline-block;text-align:right;margin-right:8px;">${idx + 1}.</span>
      <div style="overflow:hidden;">
        <div style="margin-bottom:2px;">${renderMd(e.text)}</div>
        <div style="color:gray;font-size:11px;">${esc(e.file)} \u00b7 L${e.line} \u00b7 ${errorList}</div>
      </div>
    </div>`;
  });

  errDiv.innerHTML = rows.join('');
  errDiv.querySelectorAll('.prow').forEach(el => openTask(el));

  if (warnings.length > 10) {
    errDiv.createEl('div', { text: `... and ${warnings.length - 10} more parsing errors.` })
      .style.cssText = 'padding:5px;color:gray;font-size:12px;text-align:center;';
  }
}
