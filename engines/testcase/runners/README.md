# testcase:gen

Reads **plans** from the tests hub → writes `tests/e2e/` in the FE project.

```bash
pnpm testcase:gen:dry --id TC-LOGIN-VALID
pnpm testcase:gen --id W-AD-AUTH-001
pnpm testcase:gen --id smoke
pnpm testcase:gen --testcase "$TESTKIT_TESTS_ROOT/cases/W-AD-AUTH-001/TC-LOGIN-VALID.yaml"
pnpm testcase:gen --feature W-AD-AUTH-001   # all TC-* under cases/{id}/
```

Author/edit plans in the **tests hub** (`/testcase`), not in the code project.

## Output containment

Every generated output path is preflighted before any write (dry-run
included). Targets must resolve lexically beneath `<projectRoot>/tests/e2e`;
absolute paths, `..` traversal, siblings such as `tests/e2e-evil`, and
existing symlink path components (which are never followed) are rejected with
an actionable error. Validation is all-or-nothing: if any output in a batch is
rejected, nothing is written.

Design `ir/spec.yaml` (testIds) is optional enrichment loaded from the **docs
hub** via `refs.screen` when available. Set `TESTKIT_DOCS_ROOT` explicitly for
a non-local docs hub; generation continues with testcase-only context if it is
unavailable.
