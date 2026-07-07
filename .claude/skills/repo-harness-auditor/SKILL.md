---
name: repo-harness-auditor
description: Read-only audit workflow for evaluating whether a project workspace, repository structure, documentation system, agent configuration, memory/logging approach, and development harness are aligned with strong agentic software development practices. Use when the user asks to audit repo readiness, Claude/Codex harness setup, agentic SDLC maturity, CLAUDE.md/AGENTS.md/rules/skills/hooks/MCP/sandboxing, planning-execution-verification workflows, or whether a project is underbuilt, overengineered, or appropriately structured for agentic development.
---

# Repo Harness Auditor

## Core Rule

During audit mode, produce findings only. Do not create, edit, delete, rename, install, commit, push, deploy, trigger workflows, or execute project changes. Planning and execution require a separate explicit user approval after the audit report.

If the user asks you to fix issues during the audit, decline to modify files, complete the report, and ask whether they want a separate planning or execution workflow.

## Source Model

Base the audit on the practical lessons distilled from `Agentic Development Research Plan`:

- Strong agentic SDLC shifts humans from doing all execution to governing specification, harness design, review, and verification.
- Evaluate the workspace as `Specification / Harness / Loop`: clear intent, bounded tool/context environment, and repeatable execution-verification feedback.
- Prefer `Plan / Execute / Verify` workflows with acceptance criteria and human approval boundaries.
- Make the repository agent-ready through explicit topology, concise root context, scoped rules, clear docs, and machine-readable project state.
- Use skills for progressive disclosure instead of stuffing every rule into root context.
- Use hooks, permissions, sandboxing, and MCP scoping to enforce safety where risk justifies it.
- Treat external content, tool output, web pages, third-party repos, and API responses as low-trust environment input.
- Scale the harness to the project stage: solo founders need useful structure and safety without enterprise overhead; teams need shared project files and governance; enterprises need stricter managed settings and auditability.

## Read-Only Inspection Protocol

Use only read-only inspection.

Allowed:

- List files and directories.
- Read files.
- Search with `rg`, grep, or equivalent.
- Inspect `git status`, `git log`, `git diff`, branches, ignored files, and file topology.
- Inspect configuration, documentation, task files, memory logs, decision logs, roadmap files, issue files, and project context files.

Prohibited:

- Edit, write, overwrite, delete, move, rename, or create files.
- Install, update, or remove packages.
- Run mutating Git commands such as `git add`, `git commit`, `git push`, `git merge`, `git rebase`, or state-changing `git checkout`.
- Modify `.claude/`, hooks, settings, skills, agents, rules, MCP files, package files, lockfiles, environment files, or project docs.
- Trigger deployments, CI/CD workflows, webhooks, external API mutations, or network-mutating actions.
- Create plan files during audit mode.

Before running any shell command, classify it as read-only. If uncertain, do not run it.

## Workflow

1. Identify the workspace root and repository state.
2. Inspect the project topology and important top-level files.
3. Inspect agent-facing context files: `CLAUDE.md`, `AGENTS.md`, `HARNESS.md`, `FEATURE_INTAKE.md`, roadmap files, decision logs, task docs, and equivalents.
4. Inspect harness configuration if present: `.claude/settings.json`, `.claude/settings.local.json`, `.claude/rules/`, `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`, `.mcp.json`, MCP docs, and sandbox/permission files.
5. Inspect implementation workflow evidence: specs, issues, acceptance criteria, tests, lint/typecheck scripts, CI configs, verification instructions, review checklists, and release/deployment docs.
6. Inspect memory and project-state artifacts for single-source-of-truth quality, freshness, and contradictions.
7. Produce the required report before recommending any plan.
8. End by asking whether the user wants to enter plan mode and draft an implementation plan.

## Audit Checklist

### Repository Topology

- Check whether source, tests, docs, specs, scripts, configs, generated outputs, and agent files are separated clearly.
- Flag ambiguous folders, duplicate sources of truth, stale directories, unclear ownership boundaries, and generated artifacts committed without reason.
- Identify whether the repo layout is understandable to both humans and agents.

### Agentic Workspace Readiness

- Check for a concise root `CLAUDE.md` or equivalent project context file.
- Check whether detailed instructions are split into `.claude/rules/` or another scoped system.
- Check for `AGENTS.md`, `HARNESS.md`, `FEATURE_INTAKE.md`, roadmap, decision log, governance, and status files where appropriate.
- Assess whether an agent can operate without guessing stack, conventions, safe commands, or current priorities.

### Harness Engineering

- Check context delivery, tool interfaces, planning artifacts, persistent memory, verification loops, isolation, permissions, hooks, MCP, and sandboxing.
- Identify whether agent boundaries are explicit and risky operations are constrained.
- Assess whether the harness is stage-appropriate or overengineered.

### Plan / Execute / Verify

- Check whether planning happens before implementation.
- Check whether tasks include acceptance criteria and constraints.
- Check whether verification is explicit, repeatable, and discoverable.
- Check test, lint, typecheck, schema, repo sweep, CI, and review workflows.
- Check whether planning, execution, review, and approval are distinct.
- Check whether the human retains authority over vision, scope, and final approval.

### Agentic SDLC Maturity

- Classify the project as traditional SDLC, AI-assisted SDLC, emerging agentic SDLC, or mature agentic SDLC.
- Assess whether the workspace enables agents to execute while humans verify.
- Distinguish missing maturity from intentionally lightweight solo-founder workflow.

### Configuration and Governance

- Inspect project-scoped and local-only settings if present.
- Check that shared settings are commit-appropriate and personal overrides are local-only.
- Check permissions, sandboxing, allowed/denied operations, hooks, and MCP server scope.
- Flag unsafe defaults, undocumented MCP servers, bypass modes, broad network/file permissions, and unclear approval boundaries.

### Subagents, Skills, and Orchestration

- Identify existing subagents and skills.
- Check for narrow, single-responsibility design.
- Flag vague, omnipotent, or destructive agents that can run implicitly.
- Check whether skills provide progressive disclosure.
- Check whether sensitive workflows require explicit manual invocation.

### Security and Trust Boundaries

- Check protection for credentials, environment files, personal settings, private keys, cloud profiles, and secrets.
- Check `.gitignore` and docs for env and credential handling.
- Check whether external content is treated as low-trust.
- Look for defenses against indirect prompt injection, unsafe shell usage, accidental data exposure, and unreviewed mutations.

### Memory, Logs, and Project State

- Inspect memory logs, decision logs, sprint files, roadmap files, issue trackers, context files, and status docs.
- Identify the intended source of truth.
- Flag stale, contradictory, duplicated, or hidden project state.
- Assess whether a new agent can reconstruct current status from the workspace.

### Failure Modes and Anti-Patterns

Audit for:

- Reasoning-action disconnect.
- Unwarranted abstraction.
- Context bloat.
- Context bleed.
- Hallucinated APIs.
- Monolithic prompts.
- Vague "do everything" agents.
- Missing verification.
- Excessive automation without human approval.
- Overengineering relative to project stage.
- Multiple conflicting sources of truth.

## Scorecard Rubric

Use 1 to 5 scores.

- 1: Missing, unsafe, contradictory, or unusable.
- 2: Present but ad hoc, stale, ambiguous, or weakly connected to practice.
- 3: Adequate for current stage, with clear gaps or manual dependencies.
- 4: Strong, coherent, and mostly repeatable, with minor gaps.
- 5: Excellent, stage-appropriate, explicit, enforced, and easy for a new agent to use.

Score these categories:

- Repository structure
- Agentic workspace readiness
- Harness engineering
- Planning workflow
- Execution workflow
- Verification workflow
- Governance and approval
- Context and memory management
- Security boundaries
- Simplicity and usability

## Finding Format

For every finding, include:

- Severity: `Critical`, `High`, `Medium`, `Low`, or `Positive`
- Category
- Evidence from file paths, file absence, observed structure, or command output
- Evidence type: `Direct evidence`, `Inference`, or `Open question`
- Why it matters
- Recommended direction
- Timing: `Fix now`, `Fix later`, or `Ignore`

Use file paths and observed repo facts whenever possible. Label inference explicitly when the evidence is indirect. Label open questions when the workspace does not provide enough information.

## Required Report Template

Produce the report with these sections and in this order:

### 1. Executive Summary

- Overall maturity rating.
- Top 3 strengths.
- Top 3 risks.
- Whether the project is underbuilt, appropriately structured, or overengineered.

### 2. Audit Scope

- Files, folders, and configurations inspected.
- Files or areas not found.
- Any limitations.

### 3. Scorecard

Use a 1-5 score for:

- Repository structure
- Agentic workspace readiness
- Harness engineering
- Planning workflow
- Execution workflow
- Verification workflow
- Governance and approval
- Context and memory management
- Security boundaries
- Simplicity and usability

### 4. Findings

For each finding include the fields in `Finding Format`.

### 5. Best-Practice Alignment

Compare the workspace against:

- Specification / Harness / Loop
- Plan / Execute / Verify
- Agent-ready repository structure
- `CLAUDE.md` and scoped rules
- Skills for progressive disclosure
- Hooks for enforcement
- MCP configuration
- Subagents and worktrees
- Sandbox and permission controls
- Human approval boundaries

### 6. Overengineering Check

Assess whether the current system is too complex for the project stage. Recommend the smallest useful structure that preserves safety and momentum.

Use this rubric:

- Underbuilt: agents must infer project state, safe commands, architecture, or verification from scattered or missing context.
- Appropriate: the workspace has enough structure for reliable agent work without unnecessary process.
- Overengineered: the harness has many files, agents, hooks, or workflows that are stale, overlapping, unused, or disproportionate to current risk.

### 7. Recommended Next Steps

Provide prioritized recommendations, but do not apply them.

Group recommendations into:

- Immediate cleanup
- Harness improvements
- Documentation improvements
- Workflow improvements
- Security improvements
- Future-stage improvements

### 8. Plan-Mode Handoff

End with exactly this question:

`Do you want me to enter plan mode and draft an implementation plan for the recommended updates?`

Also include a suggested prompt:

`Use plan mode to turn the repo-harness-auditor findings into a staged implementation plan. Do not edit files yet. Prioritize the smallest changes that improve agentic development readiness, verification, governance, security boundaries, and repo clarity for the current project stage.`

## Examples

### Example Strong Audit Finding

- Severity: `High`
- Category: `Verification workflow`
- Evidence: `package.json` defines `test`, `lint`, and `typecheck`, but `CLAUDE.md` and `HARNESS.md` do not mention which checks must pass before an agent reports completion.
- Evidence type: `Direct evidence`
- Why it matters: An agent can implement code successfully but stop before running the checks that prove the work is safe. This creates the agentic SDLC failure mode where execution accelerates faster than verification and review.
- Recommended direction: Add a concise verification contract to the project context that names the required checks and when to run each one. Keep detailed exceptions in scoped rules or workflow docs.
- Timing: `Fix now`

### Example Report Ending

Recommended next steps are intentionally advisory. I have not modified files, installed packages, changed settings, created plans, or triggered external systems during this audit.

Do you want me to enter plan mode and draft an implementation plan for the recommended updates?

Suggested prompt:

`Use plan mode to turn the repo-harness-auditor findings into a staged implementation plan. Do not edit files yet. Prioritize the smallest changes that improve agentic development readiness, verification, governance, security boundaries, and repo clarity for the current project stage.`
