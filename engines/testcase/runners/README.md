# testcase:gen

Reads **plans** from sibling `base-tests/` → writes `tests/e2e/` on this FE repo.

```bash
pnpm testcase:gen:dry --id TC-LOGIN-VALID
pnpm testcase:gen --id W-AD-AUTH-001
pnpm testcase:gen --id smoke
pnpm testcase:gen --testcase ../base-tests/cases/W-AD-AUTH-001/TC-LOGIN-VALID.yaml
pnpm testcase:gen --feature W-AD-AUTH-001   # all TC-* under cases/{id}/
```

Author/edit plans on **base-tests** (`/testcase`), not on this code repo.

## Output containment

Every generated output path is preflighted before any write (dry-run
included). Targets must resolve lexically beneath `<projectRoot>/tests/e2e`;
absolute paths, `..` traversal, siblings such as `tests/e2e-evil`, and
existing symlink path components (which are never followed) are rejected with
an actionable error. Validation is all-or-nothing: if any output in a batch is
rejected, nothing is written.

Design `ir/spec.yaml` (testIds) is loaded from **base-docs** via `refs.screen` when present.
