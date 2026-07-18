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
if local ArtifactGraph available: taxonomy/coverage/gap hints from this tests hub
else: local deterministic coverage/search from scoped plan + docs evidence
```

ArtifactGraph on the tests hub uses `--type=common,test` (installs the testcase
taxonomy) and indexes this repo only. Docs-hub design evidence comes through
explicit docs references, never through ArtifactGraph.

At run start, assign one stable `runId`. If ArtifactGraph is missing, complete
the local fallback, count successful file reads and exact raw bytes read into
context, then emit exactly one `testkit.missing-optional` JSON event for the
`runId` + `artifactgraph` pair. Deduplicate retries. Use
`.cursor/schemas/testkit/missing-optional-event.schema.json`; report only actual
`fileReads` and `contextBytes`, never estimated token or savings claims.
