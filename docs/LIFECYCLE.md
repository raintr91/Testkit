# Managed harness lifecycle

Testkit owns only the harness paths recorded in a compatible
`.testkit/install-manifest.json`. Lifecycle commands never remove unrecorded
files or ArtifactGraph-owned assets.

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

Common managed assets belong to every profile. In particular,
`.cursor/schemas/testkit/missing-optional-event.schema.json` remains a current
managed target across tests↔FE switches. Normal hash protection applies:
unmodified copies update safely, while local modifications conflict unless
`--force` is explicit.

```bash
testkit prune --project-root /path/to/project       # dry-run
testkit prune --project-root /path/to/project --yes # apply
```

Prune is dry-run by default and considers only inventory explicitly marked
`stale: true`. With `--yes`, Testkit deletes a stale file only when its current
hash still matches the installed hash. Modified stale files are always
preserved and remain recorded so ownership history is not lost.

## Deinitialization and global uninstall

```bash
testkit deinit                         # this repo: harness + local Cursor MCP
testkit deinit --yes                   # apply without prompting
testkit uninstall                      # all tracked repos + MCP + CLI
testkit uninstall --yes                # apply without prompting
testkit uninstall --discover ~/work --yes
```

Both commands preview changes and request confirmation in a TTY. In
non-interactive use they are dry-run unless `--yes` is explicit.

Every successful harness install records its normalized destination in:

```text
$TESTKIT_STATE_DIR/installs.json
$XDG_STATE_HOME/testkit/installs.json
~/.local/state/testkit/installs.json
```

The first configured location wins. `--discover <dir>` scans for compatible
manifest locations from older, ledger-less installs.

`deinit` is the inverse of `init` for one repo: it removes hash-matching current
and stale Testkit harness files, the manifest, and only the `testkit` key from
the repo's `.cursor/mcp.json`. `uninstall` performs that operation for every
ledger/discovery destination, removes only the global `testkit` MCP key, then
removes the Testkit CLI links/tree and ledger.

Member-modified files are preserved and reported. Invalid or shared
configuration is never replaced wholesale: other MCP keys and settings remain
untouched. Paths containing ArtifactGraph ownership markers are protected even
if a malformed or historical Testkit manifest lists them.

Advanced compatibility scopes are available through `--scope=repo`,
`all-repos`, `mcp-local`, `mcp-global`, `cli`, or `all`.
