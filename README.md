# Testkit

Independent MCP/harness for:

- `--type=tests`: `/testcase` `/grill-testcase` + `cases:render|check|coverage`
- `--type=fe`: `/test` `/grill-test` + Playwright `testcase:gen*`

Installers default to immutable release tag `v0.2.4` and enforce the committed
lockfile (`pnpm --frozen-lockfile` or `npm ci`). Set `TESTKIT_REF` /
PowerShell `-Ref` only for an explicit alternate release.

```bash
testkit init --type=tests --yes
testkit init --type=fe --tests-root=/path/to/tests-hub --docs-root=/path/to/docs-hub --yes
testkit status
testkit prune             # dry-run; changes nothing
testkit prune --yes       # delete only unmodified stale managed files
```

Switching between `tests` and `fe` keeps targets from the previous profile in
`.testkit/install-manifest.json` as stale. `status` reports compatible,
healthy, missing, modified, and stale state. `prune` only considers paths
recorded in that manifest and always preserves locally modified stale files.
The Testkit-owned optional-event schema is shared by both profiles at
`.cursor/schemas/testkit/missing-optional-event.schema.json`, so profile
switches keep it current rather than marking it stale.
See [Managed harness lifecycle](docs/LIFECYCLE.md).

Configure non-local hubs explicitly with `TESTKIT_TESTS_ROOT` and
`TESTKIT_DOCS_ROOT` (or the matching CLI options).

`testcase:gen*` preflights every generated output (dry-run included) and only
writes regular files lexically beneath `<projectRoot>/tests/e2e` — absolute
paths, `..` traversal, sibling prefixes, and symlinked path components are
rejected before anything is written, and a rejected batch writes nothing. See
[engines/testcase/runners](engines/testcase/runners/README.md).

ArtifactGraph is optional for coverage/gap acceleration only. Missing
ArtifactGraph always continues through deterministic local coverage/search and
uses the [missing-optional event contract](docs/OPTIONAL-ACCELERATORS.md).
