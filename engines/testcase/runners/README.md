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

Design `ir/spec.yaml` (testIds) is loaded from **base-docs** via `refs.screen` when present.
