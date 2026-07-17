---
name: grill-test
description: /grill-test — FE grill gate before Playwright generation.
disable-model-invocation: true
---

# /grill-test

**Owner:** Testkit (`--type=fe`)

After `/test`. Plan YAML remains on the tests hub (`/grill-testcase`).

## Accelerators (optional)

```text
if ArtifactGraph available: recommend/check testcase gen
else: local deterministic search, then testkit testcase:gen:dry …
```

Use one stable `runId` per run. When ArtifactGraph is missing, finish the local
fallback before emitting exactly one `testkit.missing-optional` event for that
`runId` + `artifactgraph`; retries must not emit again. Conform to
`.cursor/schemas/testkit/missing-optional-event.schema.json` and include only
actual successful `fileReads` and exact raw `contextBytes`, never estimates.
