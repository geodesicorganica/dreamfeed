---
name: brand-guidelines-editor
description: Researches, critiques, and updates Stakeport brand-system and brand-guideline materials using repo evidence first, then founder interrogation for unresolved decisions. Use when editing brand guidelines, design system rules, visual identity, voice/tone, product UI brand standards, Dreamfeed design standards, public-site brand expression, or when the user asks whether brand guidance should change.
---

# Brand Guidelines Editor

## Purpose

Maintain Stakeport's brand system as a governed design asset, not a loose style preference.

This skill can update:

- Brand positioning, audience framing, messaging hierarchy, and proof posture.
- Voice, tone, forbidden register, naming, and copy rules.
- Visual identity rules: type, color, logo/mark usage, imagery, data visualization, motion, layout.
- Product UI brand standards for Stakeport surfaces, including Dreamfeed / Command Center.
- Companion guidelines such as `docs/dreamfeed-ux-guidelines.md` when a rule is product-specific.

## Research Order

Do project-file research before asking the founder. Then research professional design practice before drafting guideline changes that affect visual identity, interaction design, design-system rules, or product UI standards.

1. Load mandatory source-of-truth context:
   - `shared/company-overview.md`
   - `shared/product-context.md`
   - `shared/audiences.md`
   - `shared/value-propositions.md`
   - `shared/positioning.md`
   - `shared/messaging-pillars.md`
   - `shared/voice-and-tone.md`
   - `shared/proof-points.md`
2. Load current brand materials:
   - `docs/stakeport-brand-guidelines.md`
   - `docs/stakeport-brand-guidelines.html` when visual tokens or component examples matter.
   - `docs/stakeport-strategic-foundation.md` when strategic framing is in scope.
3. Inspect live product and operating surfaces relevant to the request:
   - `c:\Projects\dreamfeed-command-center` for Dreamfeed UI behavior. (`tools/command-center/` in stakeport_os is now a redirect stub — D29 extracted the live repo 2026-07-01.)
   - `agents/**/outputs/` for approved governance, specs, feedback, and acceptance gates.
   - `CLAUDE.md` for current build state, priorities, and completed agents/skills.
4. Identify contradictions, stale rules, missing rules, and surface-specific guidance that should not pollute the parent brand system.
5. For design-system or UI guidance, inspect established practice:
   - UX heuristics and research methods from Nielsen Norman Group or equivalent HCI sources.
   - Mature product/design systems such as Apple HIG, Material Design, GOV.UK Design System, Microsoft Fluent, Atlassian, or IBM Carbon.
   - Current evidence on low-quality AI-generated design/content patterns.
   - Relevant institutional finance, analytics, IDE, or project-management product patterns when the surface is operational software.
6. Check proposed language and visual rules against [AI_SLOP_BLOCKLIST.md](AI_SLOP_BLOCKLIST.md). If new slop patterns are discovered during research, add them to the blocklist or recommend adding them before changing brand guidance.

If a question can be answered by reading the repo, answer it from the repo instead of asking the founder.

## Founder Interrogation

Use the `grill-me` pattern after repo research when judgment is still required.

- Ask one question at a time.
- For each question, provide the recommended answer and why.
- Walk the decision tree until the change has enough authority to draft.
- Do not ask questions already answered by source files.
- Distinguish founder preference from repo-derived brand law.

## Editing Rules

- Preserve the parent/child hierarchy:
  - `docs/stakeport-brand-guidelines.md` defines the parent Stakeport brand system.
  - Product-specific rules belong in companion docs when they would make the parent guide too operational.
- Keep Stakeport's voice: declarative, institutional, mechanism-named, evidence-aware.
- Avoid generic SaaS language, crypto-native hype, decorative visual rules, and unsupported claims.
- Treat Dreamfeed as internal operating software: dense, scannable, workflow-first, not marketing.
- Design like a practicing designer: define the user job, compare precedent, map hierarchy, specify states, test edge cases, and make tradeoffs explicit.
- Do not change canonical product positioning unless the shared source files support the change or the founder explicitly approves it.
- When a guideline conflicts with approved governance or product specs, flag the conflict before editing.

## Output Formats

For a research pass, return:

- `Brand Evidence`: repo facts that govern the change.
- `External Design Evidence`: professional practice, design-system, HCI, and anti-slop references used.
- `Gaps`: missing or stale guideline rules.
- `Founder Questions`: only unresolved decisions, one at a time if interactive.
- `Recommended Direction`: the smallest coherent update.

For an edit, return:

- `Files changed`
- `What changed`
- `Why it changed`
- `Open brand decisions`
- `Verification`

## Acceptance Checklist

- [ ] Repo evidence was reviewed before founder questions.
- [ ] Professional design-practice references were reviewed for UI/design-system changes.
- [ ] AI slop patterns were checked against the blocklist.
- [ ] Parent brand rules and product-specific rules are separated.
- [ ] The update preserves Stakeport's institutional register.
- [ ] Visual rules are concrete enough for implementation and review.
- [ ] New guidance names where it applies and where it does not.
- [ ] Any unresolved strategic decision is flagged instead of guessed.
