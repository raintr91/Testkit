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

Use `TESTKIT_TESTS_ROOT` (or `--tests-root`) when the tests hub is not local.
Use `TESTKIT_DOCS_ROOT` for docs evidence. Route architecture/C4 through
Hubdocs, and symbols or call graphs for repo X through the Platform DNA-wired
`codegraph-<repo-key>` server for checkout X. Never use a workspace-parent
graph or ask the member to hand-edit MCP configuration.

## Accelerators (optional)

```text
if local ArtifactGraph available: recommend/check generation allowlist (this repo)
else: local deterministic search, then run testkit testcase:gen directly
```

ArtifactGraph never follows `TESTKIT_DOCS_ROOT` / `TESTKIT_TESTS_ROOT`; plan
YAML and docs evidence flow only through those Testkit pointers.

Assign one stable `runId` at run start. If ArtifactGraph is missing, complete
the local fallback, count successful file reads and exact raw bytes read into
context, then emit exactly one `testkit.missing-optional` JSON event for the
`runId` + `artifactgraph` pair. Deduplicate retries. Validate against
`.cursor/schemas/testkit/missing-optional-event.schema.json`; report only actual
`fileReads` and `contextBytes`, never estimated token or savings claims.
