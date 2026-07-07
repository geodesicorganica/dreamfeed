'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_BACKLOG = path.join(PROJECT_ROOT, 'agents', 'founder', 'outputs', 'idea_backlog.md');
const TYPES = new Set([
  'feature',
  'agent',
  'workflow',
  'research',
  'go-to-market',
  'compliance',
  'content',
  'product',
  'ops',
  'other',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function todayLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function cell(value) {
  return String(value || '')
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}

function nextId(content) {
  let max = 0;
  for (const match of content.matchAll(/\|\s*I-(\d{4})\s*\|/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return `I-${String(max + 1).padStart(4, '0')}`;
}

function insertRow(content, row) {
  const lines = content.split(/\r?\n/);
  const inboxIndex = lines.findIndex((line) => line.trim() === '## Inbox');
  if (inboxIndex === -1) {
    throw new Error('Could not find "## Inbox" section in idea backlog.');
  }

  let insertAt = lines.length;
  for (let i = inboxIndex + 1; i < lines.length; i++) {
    if (i > inboxIndex + 1 && /^##\s+/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }

  while (insertAt > 0 && lines[insertAt - 1].trim() === '') {
    insertAt--;
  }

  lines.splice(insertAt, 0, row, '');
  return lines.join('\n');
}

function updateModifiedDate(content, date) {
  return content.replace(/date_modified:\s*"[^"]+"/, `date_modified: "${date}"`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const idea = args.idea;
  const type = (args.type || 'other').toLowerCase();
  const date = args.date || todayLocal();
  const backlogPath = path.resolve(args.file || DEFAULT_BACKLOG);

  if (!idea) {
    console.error('Missing required --idea "..." argument.');
    process.exit(1);
  }

  if (!TYPES.has(type)) {
    console.error(`Invalid --type "${type}". Use one of: ${Array.from(TYPES).join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(backlogPath)) {
    console.error(`Backlog file not found: ${backlogPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(backlogPath, 'utf8');
  const id = nextId(content);
  const row = [
    id,
    date,
    type,
    args.status || 'inbox',
    idea,
    args.source || 'codex-session',
    args.notes || '',
    args.links || '',
  ];

  const markdownRow = `| ${row.map(cell).join(' | ')} |`;
  const updated = updateModifiedDate(insertRow(content, markdownRow), date);
  fs.writeFileSync(backlogPath, updated, 'utf8');
  console.log(`Captured ${id} (${type}) in ${path.relative(PROJECT_ROOT, backlogPath)}`);
}

main();
