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
else: local deterministic coverage/search over targeted plan/docs evidence
```

Use one stable `runId` per run. When ArtifactGraph is missing, finish the local
fallback before emitting exactly one `testkit.missing-optional` event for that
`runId` + `artifactgraph`; retries must not emit again. Conform to
`.cursor/schemas/testkit/missing-optional-event.schema.json` and include only
actual successful `fileReads` and exact raw `contextBytes`, never estimates.
