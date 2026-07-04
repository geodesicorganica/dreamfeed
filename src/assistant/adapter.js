'use strict';
// Assistant adapter (D31): the ONLY module with outbound egress, and only to
// endpoints the operator configured in assistant-config.json (gitignored,
// APP_ROOT). Two provider shapes — 'cli' (spawn a local assistant CLI) and
// 'http' (POST to a configured endpoint: OpenAI-compatible, Anthropic, or
// Ollama response shapes are all accepted). Keys/headers come from config and
// are never logged, ledgered, or echoed in errors.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_FILE = path.join(APP_ROOT, 'assistant-config.json');
const TIMEOUT_MS = 60000;
const MAX_MESSAGE = 8000;
const MAX_CONTEXT = 4000;

const MODES = Object.freeze({
  'chief-of-staff': 'You are the Dreamfeed Chief of Staff. You help a founder run their daily execution queue. You may PROPOSE work: suggest task transitions, priorities, delegations, and drafts of intents — but you never execute anything; every action goes through the operator\'s explicit approval in the cockpit. Be terse, concrete, and refer to tasks by their ids.',
  'translator': 'You are the Dreamfeed Translator. Convert the operator\'s rough thoughts, notes, or feedback into structured output: a task spec (title, status, estimate, scheduled date, owner), a precise prompt for another agent, or a crisp artifact outline. Output the structure directly, no preamble.',
  'chat': 'You are the Dreamfeed cockpit assistant. Answer questions about the operator\'s work state and give short, direct help. You have no execution powers.',
});

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return null; }
}

function isConfigured() { return loadConfig() !== null; }

function buildPrompt(mode, message, context) {
  const system = MODES[mode];
  const ctx = context ? `\n\n[Operator-visible context]\n${String(context).slice(0, MAX_CONTEXT)}` : '';
  return { system, user: String(message).slice(0, MAX_MESSAGE) + ctx };
}

function runCli(cfg, prompt) {
  return new Promise((resolve) => {
    const args = [...(cfg.args || []), `${prompt.system}\n\n${prompt.user}`];
    execFile(cfg.command, args, { timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024, shell: false }, (err, stdout) => {
      if (err && !stdout) { resolve({ error: `assistant CLI failed: ${String(err.message || err).split('\n')[0]}` }); return; }
      resolve({ reply: String(stdout).trim() || '(empty reply)' });
    });
  });
}

async function runHttp(cfg, prompt) {
  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        max_tokens: cfg.maxTokens || 1024,
        messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      }),
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

module.exports = { runAssistant, isConfigured, MODES, CONFIG_FILE };
