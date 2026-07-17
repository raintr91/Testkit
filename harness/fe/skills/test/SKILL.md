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
else: run testkit testcase:gen directly
```
