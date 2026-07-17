---
name: grill-testcase
description: /grill-testcase — audit E2E plan YAML/MD on the tests hub.
disable-model-invocation: true
---

# /grill-testcase

**Owner:** Testkit (`--type=tests`)

Audit plans only. Spec holes hand off to docs-hub `/update-spec` (Bundlekit), never invent acceptance.

## Accelerators (optional)

```text
if ArtifactGraph available: coverage/gap slice
else: targeted plan/docs review
```
