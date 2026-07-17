# Managed harness lifecycle

Testkit owns only the harness paths recorded in
`.testkit/install-manifest.json`. Lifecycle commands never discover or remove
unrecorded files.

## Status

```bash
testkit status --project-root /path/to/project
```

The command checks manifest schema, package, tool API, harness API, and profile
compatibility. Managed paths are grouped as:

- `healthy`: current-profile content matches its installed hash.
- `missing`: a current-profile managed path is absent.
- `modified`: a current-profile managed path differs from its installed hash.
- `stale`: a managed path is no longer part of the manifest's `tests` or `fe`
  profile.

Status exits non-zero when compatibility fails or any path is not healthy.

## Profile changes and pruning

Running `init` with another profile preserves previous managed targets in the
manifest with `stale: true`; it does not delete them.

```bash
testkit prune --project-root /path/to/project       # dry-run
testkit prune --project-root /path/to/project --yes # apply
```

Prune is dry-run by default. With `--yes`, Testkit deletes a stale file only
when its current hash still matches the installed hash. Modified stale files
are always preserved and remain recorded so ownership history is not lost.
