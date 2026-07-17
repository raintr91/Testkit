---
name: platform-ai
description: /platform-ai — build and maintain the independent Testkit MCP package.
disable-model-invocation: true
---

# /platform-ai — build Testkit MCP

Use this skill to design, implement, test, package, and release Testkit as an
independent tests/FE MCP. Do not author product test cases here.

## Scope

- Own Testkit tools, CLI/API, renderers, generators, packaged harness, tests,
  and docs.
- Keep tests-hub and FE-consumer asset subsets explicit.
- Keep rendering and generation deterministic.
- Do not keep `platform-repos.json`, Platform DNA assets, or sibling topology.

## Workflow

1. Freeze tool, profile, and ownership contracts in `mcp-package.json`.
2. Implement behavior in `src/` and package-owned `harness/`.
3. Keep `init` managed-hash protected and profile-specific.
4. Test generated output from clean standalone fixtures.
5. Run `pnpm test` and `pnpm pack --dry-run` before release.

## Done

- Tests/FE profiles work without sibling repositories.
- Shipped files contain only Testkit-owned assets.
- Destination changes are conflict-safe and uninstallable.
- Version, docs, generated output, and tests agree.
