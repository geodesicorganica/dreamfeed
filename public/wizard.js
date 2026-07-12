'use strict';
// D36 wizard walker: pure, deterministic traversal of the onboarding question
// tree the server serves at /api/onboarding. No DOM, no fetch — app.js renders
// what these functions return, and test/wizard.test.js runs them in node
// (same discipline as layout.js, D32).

(function (global) {
  function isVisible(q, answers) {
    if (!q.showIf) return true;
    const actual = answers[q.showIf.questionId];
    if (q.showIf.equals !== undefined) return actual === q.showIf.equals;
    if (q.showIf.notEquals !== undefined) return actual !== undefined && actual !== q.showIf.notEquals;
    if (q.showIf.includes !== undefined) return Array.isArray(actual) && actual.includes(q.showIf.includes);
    return true;
  }

  function isAnswered(q, answers) {
    const v = answers[q.id];
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  function visible(questions, answers) {
    return questions.filter(function (q) { return isVisible(q, answers); });
  }

  // The next question to pose: first visible question with no answer. Returns
  // null when the interview is complete (every visible REQUIRED question is
  // answered and every visible question has been seen).
  function nextQuestion(questions, answers, seen) {
    const seenSet = seen || {};
    const vis = visible(questions, answers);
    for (let i = 0; i < vis.length; i++) {
      const q = vis[i];
      if (!isAnswered(q, answers) && !seenSet[q.id]) return q;
      if (q.required && !isAnswered(q, answers)) return q; // required can never be skipped past
    }
    return null;
  }

  function validateAnswer(q, value) {
    if (q.required) {
      const bad = value === undefined || value === null ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && !value.length);
      if (bad) return { ok: false, error: 'An answer is required here.' };
    }
    if (q.kind === 'date' && typeof value === 'string' && value.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return { ok: false, error: 'Use an ISO date: YYYY-MM-DD.' };
    }
    if ((q.kind === 'choice') && value !== undefined && value !== '' && value !== null) {
      if (!(q.options || []).some(function (o) { return o.value === value; })) return { ok: false, error: 'Pick one of the listed options.' };
    }
    if (q.kind === 'multi' && Array.isArray(value)) {
      const allowed = new Set((q.options || []).map(function (o) { return o.value; }));
      if (!value.every(function (v) { return allowed.has(v); })) return { ok: false, error: 'Pick from the listed options.' };
    }
    return { ok: true };
  }

  function progress(questions, answers) {
    const vis = visible(questions, answers);
    const answered = vis.filter(function (q) { return isAnswered(q, answers); }).length;
    return { answered: answered, total: vis.length, done: answered >= vis.length };
  }

  const api = { isVisible, isAnswered, visibleQuestions: visible, nextQuestion, validateAnswer, progress };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.DreamfeedWizard = api;
})(typeof window !== 'undefined' ? window : globalThis);
