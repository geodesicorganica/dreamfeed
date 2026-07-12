'use strict';
// D37 CLI probe: deterministic detection of locally installed assistant CLIs
// and a running Ollama, so the connect screen can offer one-click setup that
// reuses the machine's existing logins (zero keys typed or stored).
//
// Safety posture: the probe table is FIXED — client input never names a
// command. Resolution uses where/which; the version check runs the resolved
// command with a single --version arg, short timeout, capped output, and
// error strings expose codes only. `DREAMFEED_NO_PROBE=1` disables all
// probing for deterministic tests/CI (mirrors DREAMFEED_NO_NATIVE).

const { execFile } = require('child_process');

const PROBE_TIMEOUT_MS = 3000;
const OLLAMA_TIMEOUT_MS = 1000;
const VERSION_CAP = 200;

// Fixed probe table. `cliArgs` is the non-interactive invocation the adapter
// uses when this CLI is connected as the provider (prompt arrives on stdin).
const PROBE_TABLE = Object.freeze([
  { id: 'claude', label: 'Claude Code CLI', command: 'claude', cliArgs: ['-p'] },
  { id: 'codex', label: 'Codex CLI', command: 'codex', cliArgs: ['exec'] },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini', cliArgs: ['-p'] },
]);

// Ollama's local API (loopback only — inside the constraints origin allowlist).
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';

function execCapture(command, args, opts = {}) {
  return new Promise((resolve) => {
    let child;
    const done = (out) => resolve(out);
    try {
      child = execFile(command, args, {
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
        // Same .cmd-shim lesson as the adapter: npm shims need a shell on
        // win32 (execFile with shell:false throws EINVAL on Node ≥20). Only
        // fixed probe-table strings reach the shell, never client input.
        shell: process.platform === 'win32',
        maxBuffer: 64 * 1024,
        ...opts,
      }, (err, stdout) => {
        if (err) { done({ ok: false, code: err.code || 'error' }); return; }
        done({ ok: true, stdout: String(stdout || '') });
      });
    } catch (err) {
      done({ ok: false, code: (err && err.code) || 'spawn-error' });
      return;
    }
    if (!child) done({ ok: false, code: 'spawn-error' });
  });
}

async function whichCommand(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const out = await execCapture(finder, [command]);
  if (!out.ok || !out.stdout || !out.stdout.trim()) return null;
  return out.stdout.trim().split(/\r?\n/)[0];
}

async function probeCli(entry) {
  const resolved = await whichCommand(entry.command);
  if (!resolved) return { ...publicEntry(entry), found: false };
  const ver = await execCapture(entry.command, ['--version']);
  return {
    ...publicEntry(entry),
    found: true,
    // A CLI that is installed but not logged in still probes as "found" —
    // the first real call surfaces the auth failure honestly (D37).
    version: ver.ok ? ver.stdout.trim().split(/\r?\n/)[0].slice(0, VERSION_CAP) : null,
  };
}

function publicEntry(entry) {
  return { id: entry.id, label: entry.label, command: entry.command, cliArgs: [...entry.cliArgs] };
}

async function probeOllama() {
  try {
    const res = await fetch(OLLAMA_TAGS_URL, { signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS) });
    if (!res.ok) return { found: false };
    const data = await res.json();
    const models = Array.isArray(data.models)
      ? data.models.map((m) => String(m.name || '')).filter(Boolean).slice(0, 10)
      : [];
    return { found: true, models };
  } catch {
    return { found: false };
  }
}

async function probe() {
  if (process.env.DREAMFEED_NO_PROBE === '1') {
    return { probed: false, clis: [], ollama: { found: false } };
  }
  const clis = await Promise.all(PROBE_TABLE.map(probeCli));
  const ollama = await probeOllama();
  return { probed: true, clis, ollama };
}

module.exports = { probe, PROBE_TABLE };
