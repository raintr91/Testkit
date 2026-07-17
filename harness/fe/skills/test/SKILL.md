---
name: test
description: /test — Playwright E2E from tests-hub plan YAML (FE only).
disable-model-invocation: true
---

# /test

**Owner:** Testkit (`--type=fe`)

```bash
testkit testcase:gen:dry --tests-root=/path/to/tests-hub --docs-root=/path/to/docs-hub -- --id TC-…
testkit testcase:gen --tests-root=/path/to/tests-hub --docs-root=/path/to/docs-hub -- --id TC-…
```

Do not assume sibling `../base-tests`. Plans remain on the tests hub.

## Accelerators (optional)

```text
if ArtifactGraph available: recommend/check generation allowlist
else: local deterministic search, then run testkit testcase:gen directly
```

Assign one stable `runId` at run start. If ArtifactGraph is missing, complete
the local fallback, count successful file reads and exact raw bytes read into
context, then emit exactly one `testkit.missing-optional` JSON event for the
`runId` + `artifactgraph` pair. Deduplicate retries. Validate against
`.cursor/schemas/testkit/missing-optional-event.schema.json`; report only actual
`fileReads` and `contextBytes`, never estimated token or savings claims.
