'use strict';
// Project-selection adapter (D28 — founder-approved 2026-06-29). A provider-agnostic
// seam so future workspace sources (in-app breadcrumb browser, recent local
// workspaces, local agent, GitHub/GitLab, cloud workspace) can be added later
// WITHOUT changing the switch model: the commit path stays /api/project?root=.
// Today only LOCAL providers exist and `pick()` resolves a local absolute path.
// Remote providers may later resolve a provider-specific reference instead.
//
// Read-only with respect to governance/source files: a picker only chooses a
// path; it never writes project files. The native provider shells out to a
// fixed PowerShell folder-dialog script with NO request data interpolated.

const { execFile } = require('child_process');

const DEFAULT_TIMEOUT_MS = 120000;

// Fixed script — opens a folder dialog and prints the selected path or nothing.
// No interpolation: nothing from an HTTP request reaches this string.
const PS_FOLDER_DIALOG = [
  'Add-Type -AssemblyName System.Windows.Forms | Out-Null;',
  '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog;',
  '$dlg.Description = "Select a local project folder for Dreamfeed";',
  '$dlg.ShowNewFolderButton = $false;',
  // Bring the dialog to the foreground with a transient top-most owner form.
  '$owner = New-Object System.Windows.Forms.Form;',
  '$owner.TopMost = $true; $owner.ShowInTaskbar = $false; $owner.Opacity = 0;',
  'if ($dlg.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) };',
  '$owner.Dispose();',
].join(' ');

let inFlight = false; // one dialog at a time

function nativeAvailable() {
  // Backstop so the real OS dialog can never fire outside an interactive desktop
  // (e.g. a test that forgets to inject a fake provider, or CI): disable when
  // NODE_ENV=test or DREAMFEED_NO_NATIVE is set. Tests still exercise the picker
  // path through __setProviderForTest, which overrides this.
  if (process.env.DREAMFEED_NO_NATIVE || process.env.NODE_ENV === 'test') return false;
  return process.platform === 'win32';
}

function nativePick(opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  if (inFlight) return Promise.resolve({ error: 'a folder dialog is already open' });
  inFlight = true;
  return new Promise((resolve) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', PS_FOLDER_DIALOG],
      { timeout: timeoutMs, killSignal: 'SIGKILL', windowsHide: true, encoding: 'utf8' },
      (err, stdout) => {
        inFlight = false;
        if (err) {
          // execFile sets err.killed when the timeout fired; treat as a clean cancel.
          if (err.killed) return resolve({ cancelled: true, reason: 'timeout' });
          return resolve({ error: String(err.message || err).split('\n')[0] });
        }
        const path = String(stdout || '').trim();
        if (!path) return resolve({ cancelled: true });
        resolve({ path });
      }
    );
    // Defensive: if the child somehow can't be spawned, clear the flag.
    child.on('error', () => { inFlight = false; });
  });
}

// Provider registry. Each provider: { id, label, kind, available(), pick(opts) }.
const providers = {
  nativeDialog: {
    id: 'nativeDialog',
    label: 'Select folder',
    kind: 'local-native-dialog',
    available: nativeAvailable,
    pick: nativePick,
  },
  // `manual` is handled client-side (typed path -> /api/project?root=). It is
  // listed so the UI/descriptor can present it as the fallback provider; it has
  // no server-side pick step.
  manual: {
    id: 'manual',
    label: 'Manual path',
    kind: 'local-manual',
    available: () => true,
    pick: () => Promise.resolve({ error: 'manual provider is entered client-side' }),
  },
};

function listProviders() {
  return Object.values(providers)
    .filter((p) => p.available())
    .map((p) => ({ id: p.id, label: p.label, kind: p.kind }));
}

async function pick(providerId, opts = {}) {
  const p = providers[providerId];
  if (!p) return { error: `unknown picker provider: ${providerId}` };
  if (!p.available()) return { error: `picker provider not available: ${providerId}` };
  return p.pick(opts);
}

// Deliberate test seam: inject a fake provider (e.g. a cancel/timeout/path stub)
// so the suite NEVER opens a real OS dialog or spawns PowerShell. Returns a
// restore function.
function __setProviderForTest(id, fakeImpl) {
  const prev = providers[id];
  providers[id] = {
    id,
    label: (fakeImpl && fakeImpl.label) || id,
    kind: (fakeImpl && fakeImpl.kind) || 'test-fake',
    available: (fakeImpl && fakeImpl.available) || (() => true),
    pick: (fakeImpl && fakeImpl.pick) || (() => Promise.resolve({ cancelled: true })),
  };
  return function restore() { if (prev) providers[id] = prev; else delete providers[id]; };
}

module.exports = { listProviders, pick, nativeAvailable, __setProviderForTest, DEFAULT_TIMEOUT_MS };
