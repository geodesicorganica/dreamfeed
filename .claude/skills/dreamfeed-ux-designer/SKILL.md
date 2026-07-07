---
name: dreamfeed-ux-designer
description: Reviews and designs Dreamfeed / Stakeport OS Command Center user experience, information architecture, workflow priority, visual hierarchy, interaction states, and frontend acceptance criteria. Use when the user mentions Dreamfeed UX, Command Center UI, product design, approval flow, topology graph, repo health, project-management clarity, card design, visual polish, or whether the interface feels usable for daily Stakeport OS work.
---

# Dreamfeed UX Designer

## Purpose

Make Dreamfeed usable as a daily operating cockpit, not just a rendered data dump.

In this skill, UX means:

- The founder can identify the next decision or blocker within seconds.
- Approval, review, and source-file paths are visible and actionable.
- Strategic initiatives and work items show status, target date, freshness, and ordering.
- Repo health and validation state show last-run timestamps and audit provenance.
- Topology is a real graph with clickable nodes and relationships, not only grouped lists.
- Visual hierarchy supports scanning, comparison, and repeated operational use.

## Required Context

Before designing or reviewing Dreamfeed UX, load the smallest relevant set:

- `CLAUDE.md` for current build state, gates, and active priorities.
- `AGENTS.md` for project context-loading and reference-document rules.
- `docs/stakeport-brand-guidelines.md` for voice, visual identity, typography, color, and forbidden register.
- `docs/stakeport-brand-guidelines.html` only when exact tokens, spacing, or component examples are needed.
- `agents/chief-of-staff/outputs/build-stakeport-os-command-center/operational_core_ux_contract.md` for Gate F UX terms.
- `agents/developer/outputs/command-center/brief-b-acceptance-punchlist.md` when reviewing Brief B or 5b work.
- Founder feedback, interrogation transcripts, acceptance notes, or pasted review files when the task references a gate decision, acceptance review, or founder objection.
- `.agents/skills/repo-harness-auditor/SKILL.md` when designing or reviewing Repo Health, workspace health, validation status, or audit provenance surfaces.
- `c:\Projects\dreamfeed-command-center` source files when the task concerns implemented UI. (`tools/command-center/` in stakeport_os is now a redirect stub — D29 extracted the live repo 2026-07-01.)

Do not change Gate C parser/object/provenance semantics from UX work. If a UX recommendation would require changing those semantics, flag it as a governance dependency.

## Research Protocol

Research comes before layout. Do not start from visual preference or generic dashboard patterns.

1. **Evidence from the repo**
   - Read the governance, gate, punchlist, acceptance, and source files that define the Dreamfeed surface under review.
   - Confirm what data exists, what is derived, what is canonical, and what is unavailable before recommending UI treatment.
   - Treat founder feedback and interrogation files as primary UX evidence when they describe confusion, missing workflow steps, acceptance blockers, or daily-use needs.

2. **Founder daily-use workflow**
   - Evaluate whether Jorge can use Dreamfeed every day to run the Stakeport build without hunting through markdown files.
   - Research the operating questions first: what needs approval, what changed, what is blocked, what is next, what is stale, what is healthy, and where the source evidence lives.

3. **Interface precedent research**
   - Use institutional operating tools as precedents: Linear, Jira, Asana, GitHub Issues, GitHub Actions, IDE side panels, file-preview panes, graph explorers, and LLM-platform usage/status indicators.
   - Borrow interaction patterns, not brand styling. Dreamfeed should feel like serious operating software for repeated daily work.

4. **Repo Health research**
   - Treat `repo-harness-auditor` as the required read-only audit source for Repo Health UX.
   - Repo Health surfaces must show audit source, last audit run, last parsed/check time, freshness state, and whether the displayed status is live, recently updated, stale, or manually observed.
   - The auditor skill does not mutate repo health data directly; Dreamfeed consumes and displays its output or a generated audit artifact.

## Workflow

1. **Classify the task**
   - UX review, acceptance-gate review, IA redesign, visual redesign, interaction spec, or implementation QA.
   - State whether the output is advisory, a build brief, or acceptance criteria.

2. **Map the operating workflow**
   - List the daily jobs the founder must complete: approvals, blockers, initiative review, work-item review, repo health, topology inspection, milestone tracking, learning/review signals.
   - Put urgent decisions and blocked work before general status browsing.

3. **Define the information architecture**
   - Specify tab order, above-the-fold order, and default sort order.
   - Approvals and blockers should surface before Strategic Initiatives unless a gate explicitly says otherwise.
   - Past approvals, declined decisions, and resolved work should remain accessible without competing with open work.

4. **Define state semantics**
   - Every repeated item needs clear state language, not vague sameness.
   - Prefer consistent status groups: `open`, `blocked`, `active`, `behind`, `at-risk`, `complete`, `resolved`, `declined`.
   - Show target dates where the source supports them; if missing, mark `target not set` instead of inventing dates.
   - Show `last checked`, `last parsed`, or `last audit run` timestamps for repo health, validation, and workspace status.

5. **Design interaction paths**
   - Cards that represent files, approvals, agents, skills, or topology nodes must open a detail view.
   - File-backed objects should expose a readable embedded file panel or a precise local path plus the command/viewing steps.
   - Topology nodes should reveal type, source file, status, owned skills, produced outputs, inbound edges, and outbound edges.

6. **Apply Stakeport visual standards**
   - Use dense, institutional project-management patterns rather than marketing sections.
   - Use the dark palette, Inter Tight for UI, JetBrains Mono for dates/status/source paths, and risk colors only for functional state.
   - Avoid decorative gradients, glow effects, bokeh/orbs, fake chart marks, and thin colored card stripes as the primary hierarchy.
   - Cards should have restrained borders, 8px radius or less, stable dimensions, clear headings, and metadata arranged for scanning.

7. **Verify when implementation exists**
   - Run the app locally if the task is implementation QA.
   - Inspect desktop and mobile widths when practical.
   - Check that text does not overlap, status formatting is distinguishable, click targets work, graph surfaces are nonblank, and timestamps are visible.

## Output Formats

For a UX review, return:

- `Findings` ordered by operational impact.
- `Required fixes` for acceptance-blocking gaps.
- `Design direction` for layout, hierarchy, interaction, and visual system.
- `Acceptance criteria` written as testable bullets.

For a build brief, return:

- `Goal`
- `In scope`
- `Out of scope`
- `User workflows`
- `Surface-by-surface requirements`
- `Acceptance criteria`
- `Verification plan`

## Acceptance Checklist

- [ ] Founder can see open approvals and blockers first.
- [ ] Every approval has a review path to the underlying file or hosted surface.
- [ ] Strategic initiatives and work items show meaningful state, ordering, and target-date treatment.
- [ ] Repo health identifies the audit source and last-run timestamp.
- [ ] Validation status distinguishes command availability, last observed result, and stale/manual state.
- [ ] Topology renders a real graph with clickable nodes and relationship details.
- [ ] Visual design reads as institutional operating software, not generic AI-generated cards.
- [ ] UX recommendations preserve approved governance semantics unless explicitly escalated.
