# Staging — product copy from portal (temporary)

Copied from `~/workspace/portal/testgen` before removing the product-local
engine. Canonical testcase engine stays in `engines/testcase/` (Testkit-owned).

## Check tomorrow then delete this folder

- Diff this folder against its parent, excluding this file.
- Port only missing behavior worth retaining; do not overwrite Testkit SSOT.
- Resolve old imports from portal's removed `codegen/runners/lib/*`.
- After verification, delete `_staging-from-portal/`.

See `TODO-TESTGEN-PORTAL.md`.
