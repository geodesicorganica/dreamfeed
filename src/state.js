'use strict';
// Assembles the full Dreamfeed Operational Core state on demand (pull
// architecture). Every call re-reads the source files — the UI Refresh control
// maps to one call. Zero bytes are ever written to any source file (NFR1).

const path = require('path');
const {
  REPO_ROOT, parseFile, detectSchemaFamily, discoverGovernanceFiles,
  loadStalenessThresholds, computeFreshness,
} = require('./parse');
const {
  adaptStrategicInitiatives, adaptWeeklyPriorities, adaptDecisionQueue, adaptAgentDispatch,
} = require('./objects');
const { buildTopology, buildRoadmap } = require('./topology');
const { adaptMilestones, adaptReviews, adaptLearningSignals } = require('./objectsB');

// The five founder governance files Brief A loads. blocked_items.md is loaded
// for provenance/freshness/source visibility only — it renders no object in
// Brief A (Review objects are Brief B).
const SOURCE_FILES = {
  strategic_initiatives: 'agents/founder/outputs/strategic_initiatives.md',
  weekly_priorities: 'agents/founder/outputs/weekly_priorities.md',
  decision_queue: 'agents/founder/outputs/decision_queue.md',
  agent_dispatch: 'agents/founder/outputs/agent_dispatch.md',
  blocked_items: 'agents/founder/outputs/blocked_items.md',
};

function buildState(opts = {}) {
  const today = opts.today ? new Date(opts.today) : new Date();
  const errors = [];

  let thresholds = {};
  try {
    thresholds = loadStalenessThresholds(REPO_ROOT);
  } catch (err) {
    errors.push({ path: 'shared/cockpit-integration-guide.md', error: `staleness table unavailable: ${err.message}` });
  }

  // Load + classify the five sources (schema-family detection runs on every
  // parsed file before anything renders — success criterion e).
  const files = {};
  const sources = [];
  for (const [key, rel] of Object.entries(SOURCE_FILES)) {
    const f = parseFile(path.join(REPO_ROOT, rel));
    files[key] = f;
    if (f.error) errors.push({ path: f.path, error: f.error });
    const family = detectSchemaFamily(f.frontmatter);
    sources.push({
      key,
      path: rel,
      schemaFamily: family,
      governanceType: f.frontmatter ? f.frontmatter.governance_type || null : null,
      fileStatus: f.frontmatter ? f.frontmatter.status || null : null,
      dateModified: f.frontmatter ? f.frontmatter.date_modified || null : null,
      freshness: computeFreshness(f.frontmatter, thresholds, today),
      parseError: f.error,
      rendersObjects: key !== 'blocked_items',
    });
  }

  const si = adaptStrategicInitiatives(files.strategic_initiatives, thresholds, today);
  const wi = adaptWeeklyPriorities(files.weekly_priorities, si.objects, thresholds, today);
  const dq = adaptDecisionQueue(files.decision_queue, thresholds, today);
  const ad = adaptAgentDispatch(files.agent_dispatch, thresholds, today);
  errors.push(...si.errors, ...wi.errors, ...dq.errors, ...ad.errors);

  const approvals = [...dq.objects, ...ad.objects];

  // Approval Queue (FR10): every open decision row + every conditional/pending
  // dispatch gate; ordering (a view rule) = open decisions, then conditional,
  // then pending gates.
  const queue = [
    ...dq.objects.filter(a => a.state.value === 'open'),
    ...ad.objects.filter(a => a.state.value === 'conditional'),
    ...ad.objects.filter(a => a.state.value === 'pending'),
  ];

  // Discovery sweep (guide §1) — surfaced for source visibility.
  let discovered = [];
  try {
    discovered = discoverGovernanceFiles(REPO_ROOT).map(p =>
      path.relative(REPO_ROOT, p).split(path.sep).join('/'));
  } catch (err) {
    errors.push({ path: 'agents/', error: `discovery sweep failed: ${err.message}` });
  }

  // ---- Brief B fast-follow surfaces (Phase 4) ----
  const topology = buildTopology(REPO_ROOT);
  const roadmap = buildRoadmap(REPO_ROOT);
  const milestones = adaptMilestones(roadmap.objects, si.objects);
  const reviews = adaptReviews(REPO_ROOT, thresholds, today);
  const learningSignals = adaptLearningSignals(REPO_ROOT, thresholds, today);
  errors.push(...topology.errors, ...roadmap.errors, ...milestones.errors, ...reviews.errors, ...learningSignals.errors);

  return {
    generatedAt: new Date().toISOString(),
    asOfDate: today.toISOString().slice(0, 10),
    readOnly: true,
    ui: { alias: 'Dreamfeed', canonicalName: 'Stakeport OS Command Center — Operational Core (Brief A)' },
    thresholdsSource: 'shared/cockpit-integration-guide.md §3',
    thresholds,
    sources,
    strategicInitiatives: si.objects,
    workItems: wi.objects,
    approvals,
    approvalQueue: queue,
    discoveredGovernanceFiles: discovered,
    // Brief B fast-follow surfaces
    topology: { nodes: topology.nodes, edges: topology.edges, repoInventory: topology.repoInventory, tally: topology.tally },
    roadmap: roadmap.objects,
    milestones: milestones.objects,
    reviews: reviews.objects,
    learningSignals: learningSignals.objects,
    parseErrors: errors,
    counts: {
      strategicInitiatives: si.objects.length,
      workItems: wi.objects.length,
      approvalsTotal: approvals.length,
      decisionApprovals: dq.objects.length,
      openDecisions: dq.objects.filter(a => a.state.value === 'open').length,
      dispatchGateApprovals: ad.objects.length,
      conditionalGates: ad.objects.filter(a => a.state.value === 'conditional').length,
      pendingGates: ad.objects.filter(a => a.state.value === 'pending').length,
      approvalQueue: queue.length,
      discoveredGovernanceFiles: discovered.length,
      topologyNodes: topology.nodes.length,
      topologyEdges: topology.edges.length,
      topologyCanonicalEdges: topology.tally.Canonical,
      topologyDerivedEdges: topology.tally.Derived,
      roadmapPhases: roadmap.objects.length,
      milestones: milestones.objects.length,
      reviews: reviews.objects.length,
      learningSignals: learningSignals.objects.length,
      parseErrors: errors.length,
    },
  };
}

module.exports = { buildState, SOURCE_FILES };
