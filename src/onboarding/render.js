'use strict';
// D36 template renderer: pure placeholder substitution plus per-section
// provenance. Deliberately tiny — no expressions, no recursion, no fs.
//
// Placeholders:
//   {{q:<question-id>}}    the operator's answer (arrays join with ", ")
//   {{ctx:<key>}}          per-file context supplied by the generator
//   {{#if q:<id>}}...{{/if}}      block kept only when the answer is non-empty
//   {{#if ctx:<key>}}...{{/if}}   same for context values
//
// Provenance: for every markdown heading block in the TEMPLATE, the question
// ids referenced inside that block are recorded — this is what makes each
// generated section answer "which answers produced this?" (D36 invariant).

const PLACEHOLDER = /\{\{(q|ctx):([a-z0-9-]+)\}\}/gi;
const IF_BLOCK = /\{\{#if (q|ctx):([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;

function valueOf(kind, key, answers, ctx) {
  const v = kind === 'q' ? answers[key] : ctx[key];
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function isTruthy(kind, key, answers, ctx) {
  const v = kind === 'q' ? answers[key] : ctx[key];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

// Single-line sanitation: placeholder values must never break the surrounding
// markdown structure (a heading, a table row, frontmatter). Multi-line answers
// keep their newlines only where the template marks the slot as a block
// ({{q:id}} alone on its line); inline slots collapse whitespace.
function substitute(template, answers, ctx) {
  const withBlocks = template.replace(IF_BLOCK, (_, kind, key, body) =>
    isTruthy(kind, key, answers, ctx) ? body : '');
  return withBlocks.replace(PLACEHOLDER, (match, kind, key, offset) => {
    const raw = valueOf(kind, key, answers, ctx);
    const lineStart = withBlocks.lastIndexOf('\n', offset) + 1;
    const line = withBlocks.slice(lineStart, withBlocks.indexOf('\n', offset) === -1 ? undefined : withBlocks.indexOf('\n', offset));
    const isBlockSlot = line.trim() === match;
    const value = isBlockSlot ? raw : raw.replace(/\s+/g, ' ').trim();
    // Table rows: a raw pipe would inject a column.
    return line.trimStart().startsWith('|') ? value.replace(/\|/g, '\\|') : value;
  });
}

// Section provenance from the TEMPLATE (not the output): heading → question ids
// referenced anywhere in that heading's block (until the next heading of the
// same-or-higher level, simplified to "next heading").
function provenanceOf(template) {
  const lines = template.split('\n');
  const sections = [];
  let current = { heading: '(preamble)', ids: new Set() };
  for (const line of lines) {
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      if (current.ids.size) sections.push({ section: current.heading, questionIds: [...current.ids] });
      current = { heading: h[1].trim(), ids: new Set() };
      // A placeholder on the heading line itself belongs to the new section.
    }
    for (const m of line.matchAll(/\{\{(?:#if )?q:([a-z0-9-]+)\}\}/gi)) current.ids.add(m[1]);
  }
  if (current.ids.size) sections.push({ section: current.heading, questionIds: [...current.ids] });
  return sections;
}

function render(template, answers = {}, ctx = {}) {
  return {
    content: substitute(template, answers, ctx),
    provenance: provenanceOf(template),
  };
}

module.exports = { render, provenanceOf };
