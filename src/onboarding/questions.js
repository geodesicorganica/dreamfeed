'use strict';
// D36 deterministic interview tree. Product-authored DATA, no fs, no model:
// the wizard walks this tree (public/wizard.js), the generator consumes the
// answers (src/onboarding/generate.js). Every generated file section traces
// back to question ids via `feeds`, so generation stays explainable.
//
// Question shape:
//   id        stable id ("q-...") — referenced by templates as {{q:id}}
//   family    which artifact family the answer primarily feeds (identity feeds all)
//   prompt    the deterministic question text (assistant may rephrase, never replace)
//   help      one-line context shown under the prompt
//   kind      text | textarea | choice | multi | date
//   required  wizard refuses to advance without an answer
//   options   [{value, label}] for choice/multi
//   showIf    { questionId, equals?, includes? } — branch condition
//   prefillFrom  importer key (Slice 4) whose draft pre-populates the answer

const QUESTIONS = Object.freeze([
  // --- identity (feeds every family) ---------------------------------------
  {
    id: 'q-business-name', family: 'identity', kind: 'text', required: true,
    prompt: 'What is this business (or project) called?',
    help: 'Used as the display name across every generated document.',
    prefillFrom: 'projectName',
  },
  {
    id: 'q-one-liner', family: 'identity', kind: 'text', required: true,
    prompt: 'In one sentence: what does it do, and for whom?',
    help: 'The sentence that opens your strategy and harness documents.',
  },
  {
    id: 'q-operator-name', family: 'identity', kind: 'text', required: false,
    prompt: 'What should the cockpit call you (the operator)?',
    help: 'Defaults to "Founder". Used for Owner fields and agent reporting lines.',
  },
  {
    id: 'q-stage', family: 'identity', kind: 'choice', required: true,
    prompt: 'Where is the business today?',
    options: [
      { value: 'idea', label: 'Idea — not yet operating' },
      { value: 'building', label: 'Building — product/service in progress' },
      { value: 'operating', label: 'Operating — serving customers' },
      { value: 'scaling', label: 'Scaling — growing something that works' },
    ],
  },
  {
    id: 'q-customer', family: 'identity', kind: 'textarea', required: true,
    prompt: 'Who is the customer, concretely?',
    help: 'A person or organization you could name; not a demographic.',
  },
  {
    id: 'q-model', family: 'docs', kind: 'textarea', required: false,
    prompt: 'How does it make money (or how will it)?',
    showIf: { questionId: 'q-stage', notEquals: 'idea' },
  },
  {
    id: 'q-model-hypothesis', family: 'docs', kind: 'textarea', required: false,
    prompt: 'What is the monetization hypothesis you intend to test first?',
    showIf: { questionId: 'q-stage', equals: 'idea' },
  },
  {
    id: 'q-success-12mo', family: 'identity', kind: 'textarea', required: true,
    prompt: 'Twelve months from now, what has to be true for you to call this a success?',
    help: 'Feeds the strategy document and anchors your first goal.',
  },

  // --- docs: strategy / roadmap / brand -------------------------------------
  {
    id: 'q-positioning', family: 'docs', kind: 'textarea', required: false,
    prompt: 'Why you — what makes this credible against the alternatives your customer has today?',
  },
  {
    id: 'q-brand-voice', family: 'docs', kind: 'choice', required: false,
    prompt: 'Which voice should the brand write in?',
    options: [
      { value: 'precise-institutional', label: 'Precise and institutional' },
      { value: 'warm-approachable', label: 'Warm and approachable' },
      { value: 'bold-provocative', label: 'Bold and provocative' },
      { value: 'plain-utilitarian', label: 'Plain and utilitarian' },
    ],
  },
  {
    id: 'q-brand-values', family: 'docs', kind: 'text', required: false,
    prompt: 'Name up to three values the brand must never violate (comma-separated).',
  },

  // --- os-core: first goal + operations -------------------------------------
  {
    id: 'q-goal-title', family: 'os-core', kind: 'text', required: true,
    prompt: 'What is the single most important outcome for the next 90 days?',
    help: 'Becomes your first Goal file — the spine of the Daily Execution Queue.',
    prefillFrom: 'goalTitle',
  },
  {
    id: 'q-goal-milestone', family: 'os-core', kind: 'text', required: true,
    prompt: 'What is the first milestone that proves you are on the way to that outcome?',
    prefillFrom: 'goalMilestone',
  },
  {
    id: 'q-goal-first-task', family: 'os-core', kind: 'text', required: true,
    prompt: 'What is the very first concrete task, small enough to start today?',
    prefillFrom: 'goalFirstTask',
  },
  {
    id: 'q-goal-target-date', family: 'os-core', kind: 'date', required: false,
    prompt: 'When should this goal be done? (ISO date, e.g. 2026-09-30)',
  },
  {
    id: 'q-cadences', family: 'os-core', kind: 'multi', required: false,
    prompt: 'Which recurring operations should the cockpit track from day one?',
    options: [
      { value: 'weekly-review', label: 'Weekly review — priorities, blockers, decisions' },
      { value: 'content', label: 'Content — publishing cadence' },
      { value: 'outreach', label: 'Outreach — sales / partnerships pipeline' },
      { value: 'support', label: 'Customer support / success' },
      { value: 'finance', label: 'Finance — invoicing, runway, bookkeeping' },
    ],
  },

  // --- agents ----------------------------------------------------------------
  {
    id: 'q-agent-domains', family: 'agents', kind: 'multi', required: false,
    prompt: 'Beyond the Founder and Chief of Staff, which domain agents should exist?',
    help: 'Each becomes an agents/<id>/AGENT.md definition wired into the topology.',
    options: [
      { value: 'content-marketing', label: 'Content & marketing' },
      { value: 'research-intelligence', label: 'Research & intelligence' },
      { value: 'sales', label: 'Sales & partnerships' },
      { value: 'developer', label: 'Developer / product engineering' },
      { value: 'operations-admin', label: 'Operations & admin' },
    ],
  },

  // --- harness ----------------------------------------------------------------
  {
    id: 'q-coding-agent', family: 'harness', kind: 'choice', required: false,
    prompt: 'Which coding agent will work in this repo, if any?',
    options: [
      { value: 'claude-code', label: 'Claude Code' },
      { value: 'codex', label: 'Codex' },
      { value: 'cursor', label: 'Cursor' },
      { value: 'none', label: 'None / not sure yet' },
    ],
  },
  {
    id: 'q-conventions', family: 'harness', kind: 'textarea', required: false,
    prompt: 'Any hard rules agents must respect in this repo? (constraints, no-go areas, style)',
  },
]);

// Deterministic tree walk: the next unanswered, visible question. Branching is
// evaluated against the answers so far; a hidden question never blocks.
function isVisible(q, answers) {
  if (!q.showIf) return true;
  const actual = answers[q.showIf.questionId];
  if (q.showIf.equals !== undefined) return actual === q.showIf.equals;
  if (q.showIf.notEquals !== undefined) return actual !== undefined && actual !== q.showIf.notEquals;
  if (q.showIf.includes !== undefined) return Array.isArray(actual) && actual.includes(q.showIf.includes);
  return true;
}

function visibleQuestions(answers = {}) {
  return QUESTIONS.filter((q) => isVisible(q, answers));
}

function missingRequired(answers = {}) {
  return visibleQuestions(answers)
    .filter((q) => q.required)
    .filter((q) => {
      const v = answers[q.id];
      return v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    })
    .map((q) => q.id);
}

module.exports = { QUESTIONS, isVisible, visibleQuestions, missingRequired };
