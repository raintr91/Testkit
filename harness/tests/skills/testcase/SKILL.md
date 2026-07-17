---
name: testcase
description: /testcase — author E2E plan YAML/MD on the tests hub (not Playwright).
disable-model-invocation: true
---

# /testcase

**Owner:** Testkit (`--type=tests`)

Author SC/TC/suites on the current tests hub. Design rules stay on the docs hub.
Playwright generation is FE `/test`.

```bash
testkit cases:render -- …
testkit cases:check -- …
```

## Accelerators (optional)

```text
if ArtifactGraph available: coverage/gap hints
else: model review from scoped plan + docs evidence
```
