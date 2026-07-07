---
definition_type: topology_manifest
schema: dreamfeed-topology/v1
---

# Topology Manifest

Promoted through the governed lifecycle (D32).

## Nodes

| Id | Kind | Name | Promoted From | Matched By |
|---|---|---|---|---|
| summarizer | agent | Summarizer | prompts/summarize.md | path:prompts |
| ci-build | workflow | CI Build | .github/workflows/ci.yml | path:.github/workflows |

## Edges

| From | Type | To |
|---|---|---|
| summarizer | produces | docs/summary.md |
