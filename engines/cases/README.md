# Case plan checks

`check-plans.mjs` parses every `cases/TC-*.yaml` under the project cwd and
validates with Ajv draft 2020-12 against the package SSOT
`schemas/testcase.schema.json` (resolved from this package, not the destination
cwd). Override only for tests via `TESTKIT_TESTCASE_SCHEMA`.

Change testcase validation rules in that schema rather than in the checker.
