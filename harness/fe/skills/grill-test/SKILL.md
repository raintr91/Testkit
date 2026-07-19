---
name: grill-test
description: /grill-test — FE grill gate before Playwright generation.
disable-model-invocation: true
---

# /grill-test

**Owner:** Testkit (`--type=fe`)

After `/test`. Plan YAML remains on the tests hub (`/grill-testcase`).

Route architecture/C4 through Hubdocs, plans/docs through
`TESTKIT_TESTS_ROOT` / `TESTKIT_DOCS_ROOT`, and repo-X symbols through its
Platform DNA-wired `codegraph-<repo-key>` server. Never substitute the current
repo index for another checkout or initialize a workspace-parent graph.

## Accelerators (optional)

```text
if local ArtifactGraph available: recommend/check testcase gen (this repo)
else: local deterministic search, then testkit testcase:gen:dry …
```

ArtifactGraph never follows `TESTKIT_DOCS_ROOT` / `TESTKIT_TESTS_ROOT`; plan
YAML and docs evidence flow only through those Testkit pointers.

Use one stable `runId` per run. When ArtifactGraph is missing, finish the local
fallback before emitting exactly one `testkit.missing-optional` event for that
`runId` + `artifactgraph`; retries must not emit again. Conform to
`.cursor/schemas/testkit/missing-optional-event.schema.json` and include only
actual successful `fileReads` and exact raw `contextBytes`, never estimates.
