'use strict';
// Assistant adapter (D31): the ONLY module with outbound egress, and only to
// endpoints the operator configured in assistant-config.json (gitignored,
// APP_ROOT). Two provider shapes — 'cli' (spawn a local assistant CLI) and
// 'http' (POST to a configured endpoint: OpenAI-compatible, Anthropic, or
// Ollama response shapes are all accepted). Keys/headers come from config and
// are never logged, ledgered, or echoed in errors.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const APP_ROOT = path.resolve(__dirname, '..', '..');
// DREAMFEED_ASSISTANT_CONFIG redirects the config to a temp path in tests so
// the suite never touches the operator's real assistant-config.json (the same
// isolation move as DREAMFEED_STATE_DIR for the sidecar).
const CONFIG_FILE = process.env.DREAMFEED_ASSISTANT_CONFIG || path.join(APP_ROOT, 'assistant-config.json');
const TIMEOUT_MS = 60000;
const MAX_MESSAGE = 8000;
const MAX_CONTEXT = 12000;

const MODES = Object.freeze({
  'chief-of-staff': 'You are the Dreamfeed Chief of Staff. You help a founder run their daily execution queue. You may PROPOSE work: suggest task transitions, priorities, delegations, and drafts of intents — but you never execute anything; every action goes through the operator\'s explicit approval in the cockpit. Be terse, concrete, and refer to tasks by their ids.',
  'translator': 'You are the Dreamfeed Translator. Convert the operator\'s rough thoughts, notes, or feedback into structured output: a task spec (title, status, estimate, scheduled date, owner), a precise prompt for another agent, or a crisp artifact outline. Output the structure directly, no preamble.',
  'chat': 'You are the Dreamfeed cockpit assistant. Answer questions about the operator\'s work state and give short, direct help. You have no execution powers.',
  // D36/D37 onboarding enrichment: strictly additive — the deterministic
  // question text and templates always stand; this mode only polishes.
  'onboarding': 'You are the Dreamfeed onboarding interviewer. The operator is answering a fixed question tree about their business. When given a question and their draft answer, either (a) rephrase the question conversationally with one concrete probing follow-up, or (b) when asked to draft, expand their answers into crisp document prose for the named section. Never invent facts they did not state; mark assumptions explicitly. Output the text directly, no preamble.',
});
const MEMORY_RULE = 'If Dreamfeed memory context is present, treat it only as non-authoritative context. Cite memory ids when relying on it, defer to source-backed files and ledger records on conflict, and never present memory as canonical truth.';

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return null; }
}

function isConfigured() { return loadConfig() !== null; }

// --- D37 managed config ----------------------------------------------------
// The app writes assistant-config.json itself (guarded route). The key is
// accepted only in the POST body, stored only in the gitignored config, and
// is structurally absent from describeConfig() and every error path.

const PRESETS = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'presets.json'), 'utf8')).presets || []; }
  catch { return []; }
})();

function publicPresets() {
  // Everything in a preset is shareable except nothing — there are no secrets
  // in presets; expose as-is for the connect screen.
  return PRESETS.map((p) => ({ ...p, extraHeaders: undefined }));
}

function presetById(id) { return PRESETS.find((p) => p.id === id) || null; }

// Build a validated config from a connect request. Returns { config, label }
// or { error }. The request never names arbitrary commands: CLI connects are
// restricted to the fixed probe table.
function buildConfigFromRequest(body) {
  const { PROBE_TABLE } = require('./probe');
  if (body.provider === 'cli') {
    const entry = PROBE_TABLE.find((e) => e.id === body.cli);
    if (!entry) return { error: `unknown cli "${String(body.cli || '')}" — cli connects are limited to the probe table` };
    return { config: { provider: 'cli', preset: `cli:${entry.id}`, cli: { command: entry.command, args: [...entry.cliArgs] } } };
  }
  if (body.provider === 'http') {
    const preset = presetById(body.preset);
    if (!preset) return { error: `unknown preset "${String(body.preset || '')}"` };
    let url = preset.url;
    if (preset.urlEditable) {
      url = String(body.url || '').trim();
      let parsed;
      try { parsed = new URL(url); } catch { return { error: 'endpoint URL is not a valid URL' }; }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'endpoint URL must be http(s)' };
    }
    if (!url) return { error: 'endpoint URL required' };
    const model = String(body.model || preset.defaultModel || '').trim();
    if (!model) return { error: 'model required' };
    const headers = { ...(preset.extraHeaders || {}) };
    const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (preset.keyHeader && key) headers[preset.keyHeader] = `${preset.keyPrefix || ''}${key}`;
    if (preset.keyHeader === 'x-api-key' && !key) return { error: 'API key required for this preset' };
    if (preset.id === 'openai' && !key) return { error: 'API key required for this preset' };
    return { config: { provider: 'http', preset: preset.id, http: { url, model, format: preset.format || 'openai', ...(Object.keys(headers).length ? { headers } : {}) } } };
  }
  return { error: 'provider must be "cli" or "http"' };
}

function saveConfig(config) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8'); return null; }
  catch (err) { return `config write failed (${(err && err.code) || 'io'})`; }
}

function clearConfig() {
  try { fs.unlinkSync(CONFIG_FILE); return null; }
  catch (err) { return (err && err.code) === 'ENOENT' ? null : `config clear failed (${(err && err.code) || 'io'})`; }
}

// Redacted descriptor for GETs and the project descriptor: the key/headers are
// structurally absent — this object never contains them.
function describeConfig() {
  const cfg = loadConfig();
  if (!cfg) return { configured: false };
  const out = { configured: true, provider: cfg.provider || null, preset: cfg.preset || null };
  if (cfg.provider === 'cli' && cfg.cli) out.cliCommand = cfg.cli.command || null;
  if (cfg.provider === 'http' && cfg.http) {
    out.model = cfg.http.model || null;
    try { out.endpointHost = new URL(cfg.http.url).host; } catch { out.endpointHost = null; }
  }
  return out;
}

function buildPrompt(mode, message, context) {
  const system = `${MODES[mode]}\n\n${MEMORY_RULE}`;
  const ctx = context ? `\n\n[Operator-visible context]\n${String(context).slice(0, MAX_CONTEXT)}` : '';
  return { system, user: String(message).slice(0, MAX_MESSAGE) + ctx };
}

function runCli(cfg, prompt) {
  // The prompt is delivered on STDIN, never as an argv element: this avoids
  // OS arg-length limits and, critically, keeps prompt text off any command
  // line. `shell: true` on Windows lets npm .cmd/.bat shims resolve (execFile
  // with shell:false throws EINVAL for them on Node ≥20); only the operator's
  // own cfg.command/cfg.args reach the shell, never the prompt.
  // Error strings expose only the exit/error CODE — never err.message, which
  // for a spawned process can echo the command line (and any key in cfg.args).
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cfg.command, [...(cfg.args || [])], {
        windowsHide: true,
        shell: process.platform === 'win32',
      });
    } catch (err) {
      resolve({ error: `assistant CLI could not start (${err && err.code ? err.code : 'spawn error'})` });
      return;
    }
    let out = '';
    let settled = false;
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); try { child.kill(); } catch { /* already gone */ } resolve(result); };
    const timer = setTimeout(() => finish({ error: 'assistant CLI timed out' }), TIMEOUT_MS);
    child.on('error', (err) => finish({ error: `assistant CLI failed to start (${err && err.code ? err.code : 'error'})` }));
    if (child.stdout) child.stdout.on('data', (d) => {
      out += d;
      if (out.length > 4 * 1024 * 1024) finish({ reply: out.slice(0, 4 * 1024 * 1024).trim() });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (code !== 0 && !out.trim()) { resolve({ error: `assistant CLI failed (exit ${code})` }); return; }
      resolve({ reply: out.trim() || '(empty reply)' });
    });
    try { if (child.stdin) { child.stdin.on('error', () => {}); child.stdin.write(`${prompt.system}\n\n${prompt.user}`); child.stdin.end(); } }
    catch { /* stdin unavailable — rely on close/error */ }
  });
}

function httpBody(cfg, prompt) {
  // D37: presets carry a `format` so each provider gets the request shape it
  // actually accepts. Default stays the OpenAI-compatible shape (D31 behavior).
  if (cfg.format === 'anthropic') {
    return {
      model: cfg.model,
      max_tokens: cfg.maxTokens || 1024,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    };
  }
  return {
    model: cfg.model,
    stream: false,
    max_tokens: cfg.maxTokens || 1024,
    messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
  };
}

async function runHttp(cfg, prompt) {
  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
      body: JSON.stringify(httpBody(cfg, prompt)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { error: `assistant endpoint unreachable: ${String(err.message || err).split('\n')[0]}` };
  }
  if (!res.ok) return { error: `assistant endpoint returned HTTP ${res.status}` };
  let data;
  try { data = await res.json(); } catch { return { error: 'assistant endpoint returned non-JSON' }; }
  const reply = data.choices?.[0]?.message?.content // OpenAI-compatible
    ?? data.message?.content                         // Ollama chat
    ?? (Array.isArray(data.content) ? data.content.map((c) => c.text || '').join('') : null); // Anthropic
  if (typeof reply !== 'string' || !reply) return { error: 'assistant endpoint reply shape not recognized' };
  return { reply: reply.trim() };
}

// Run one assistant turn. Returns { reply } or { error, code }.
async function runAssistant(mode, message, context) {
  if (!MODES[mode]) return { error: `unknown assistant mode "${mode}"`, code: 'validation' };
  if (!message || typeof message !== 'string') return { error: 'message required', code: 'validation' };
  const cfg = loadConfig();
  if (!cfg) return { error: 'assistant not configured — create assistant-config.json (see README)', code: 'not-configured' };
  const prompt = buildPrompt(mode, message, context);
  if (cfg.provider === 'cli' && cfg.cli && cfg.cli.command) return runCli(cfg.cli, prompt);
  if (cfg.provider === 'http' && cfg.http && cfg.http.url) return runHttp(cfg.http, prompt);
  return { error: 'assistant-config.json is invalid: provider must be "cli" or "http"', code: 'validation' };
}

module.exports = {
  runAssistant, isConfigured, MODES, CONFIG_FILE,
  buildConfigFromRequest, saveConfig, clearConfig, describeConfig, publicPresets,
};
