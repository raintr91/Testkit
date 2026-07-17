# Testkit

Independent MCP/harness for:

- `--type=tests`: `/testcase` `/grill-testcase` + `cases:render|check|coverage`
- `--type=fe`: `/test` `/grill-test` + Playwright `testcase:gen*`

```bash
testkit init --type=tests --yes
testkit init --type=fe --tests-root=/path/to/tests-hub --docs-root=/path/to/docs-hub --yes
```

Do not assume sibling `../base-tests` or `../base-docs`. Pass explicit roots.

ArtifactGraph is optional for coverage/gap acceleration only.
