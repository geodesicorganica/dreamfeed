---
schema: dreamfeed/v1
type: policy
date_modified: "2026-07-18"
generated_by: dreamfeed-onboarding/v1
---
# Policy

Operation classes for the governed write lifecycle. `auto` is ledgered and
policy-approved; `approve` needs explicit operator approval; `founder` adds
typed confirmation; unknown operations are denied.

| Operation | Class |
|---|---|
| task-transition | auto |
| work-file-edit | approve |
| promote-topology | approve |
| scaffold-project | approve |
| git-init | approve |
| git-add | approve |
| git-commit | approve |
| git-branch | approve |
| git-switch | approve |
| git-push | founder |
| rollback | founder |
