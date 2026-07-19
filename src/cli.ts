import {
  packageRoot,
  packageVersion,
  resolveProjectRoot,
  type TestkitType,
} from './config/project-root.js'
import { lstatSync, realpathSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { installCursorMcp, uninstallCursorMcp } from './install/cursor-mcp.js'
import {
  installHarness,
  pruneHarness,
  SKILLS_BY_TYPE,
  statusHarness,
  uninstallHarness,
  type HarnessStatus,
} from './install/harness.js'
import { discoverInstalls, ledgerPath, readLedger, removeLedger } from './install/ledger.js'
import { selectPrompt } from './install/prompt.js'
import { runEngine } from './engines/run.js'

function arg(name: string): string | undefined {
  const eq = process.argv.find((value) => value.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function has(name: string): boolean {
  return process.argv.includes(name)
}

function passthrough(command: string): string[] {
  const index = process.argv.indexOf(command)
  return index >= 0 ? process.argv.slice(index + 1) : process.argv.slice(3)
}

function usage(): never {
  console.log(`testkit ${packageVersion()}

  init --type=tests|fe [--project-root <path>] [--tests-root <path>] [--docs-root <path>] [--force] [--yes]
  status [--project-root <path>]
  prune [--project-root <path>] [--yes]    # stale-only; dry-run unless --yes
  deinit [--project-root <path>] [--yes]   # current repo harness + local MCP
  uninstall [--discover <dir>] [--yes]     # all repos + local/global MCP + CLI

Advanced uninstall filters:
  uninstall --scope=repo|all-repos|mcp-local|mcp-global|cli|all
            [--project-root <path>] [--keep-mcp] [--yes]

  cases:render|cases:check|cases:coverage [--project-root <path>] -- …engine args
  testcase:gen|testcase:gen:dry|e2e-registry [--project-root <path>] [--tests-root <path>] [--docs-root <path>] -- …engine args
  version

Owned skills:
  tests: ${SKILLS_BY_TYPE.tests.map((id) => `/${id}`).join(' ')}
  fe: ${SKILLS_BY_TYPE.fe.map((id) => `/${id}`).join(' ')}
`)
  process.exit(1)
}

function printResult(result: { status: number | null; stdout: string; stderr: string }): never {
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

function printStatus(status: HarnessStatus): void {
  console.log(`manifest: ${status.manifestPath}`)
  console.log(`compatibility: ${status.compatibility.compatible ? 'compatible' : 'incompatible'}`)
  for (const issue of status.compatibility.issues) console.log(`  issue: ${issue}`)
  for (const bucket of ['healthy', 'missing', 'modified', 'stale'] as const) {
    console.log(`${bucket}: ${status[bucket].length}`)
    for (const file of status[bucket]) console.log(`  ${file}`)
  }
}

type UninstallScope = 'repo' | 'all-repos' | 'mcp-local' | 'mcp-global' | 'cli' | 'all'
const UNINSTALL_SCOPES: UninstallScope[] = [
  'repo',
  'all-repos',
  'mcp-local',
  'mcp-global',
  'cli',
  'all',
]

interface UninstallFlags {
  yes: boolean
  keepMcp: boolean
  projectRoot?: string
  discoverDir?: string
}

function lexists(file: string): boolean {
  try {
    lstatSync(file)
    return true
  } catch {
    return false
  }
}

function realOrSelf(file: string): string {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

function cliLayout(): { installDir: string; binDir: string } {
  return {
    installDir: process.env.TESTKIT_INSTALL_DIR
      ? path.resolve(process.env.TESTKIT_INSTALL_DIR)
      : path.join(os.homedir(), '.testkit'),
    binDir: process.env.TESTKIT_BIN_DIR
      ? path.resolve(process.env.TESTKIT_BIN_DIR)
      : path.join(os.homedir(), '.local', 'bin'),
  }
}

function removeCli(dryRun: boolean): void {
  const { installDir, binDir } = cliLayout()
  const current = realOrSelf(process.cwd())
  const targets = [
    path.join(binDir, 'testkit'),
    path.join(binDir, 'testkit-mcp'),
    path.join(binDir, 'testkit.cmd'),
    path.join(binDir, 'testkit-mcp.cmd'),
    installDir,
  ]
  for (const target of targets) {
    if (!lexists(target)) continue
    if (target === installDir && realOrSelf(target) === current) {
      console.log(`  skip: ${target} (current directory; remove manually)`)
      continue
    }
    if (dryRun) console.log(`  would remove: ${target}`)
    else {
      try {
        rmSync(target, { recursive: true, force: true })
        console.log(`  removed: ${target}`)
      } catch (error) {
        console.log(`  skip: ${target} (${error instanceof Error ? error.message : String(error)})`)
      }
    }
  }
}

function repoTargets(flags: UninstallFlags): string[] {
  const repos = new Set(readLedger())
  if (flags.discoverDir) {
    for (const repo of discoverInstalls(flags.discoverDir)) repos.add(repo)
  }
  return [...repos]
}

function runUninstallScope(scope: UninstallScope, flags: UninstallFlags): void {
  const root = path.resolve(flags.projectRoot ?? process.cwd())
  const removeRepo = (repo: string): void => {
    console.log(`repo: ${repo}`)
    const result = uninstallHarness({ projectRoot: repo, yes: flags.yes })
    for (const file of result.wouldDelete) console.log(`  would delete: ${file}`)
    for (const file of result.deleted) console.log(`  deleted: ${file}`)
    for (const file of result.preservedModified) console.log(`  preserve modified: ${file}`)
    for (const file of result.preservedProtected) console.log(`  preserve protected: ${file}`)
    for (const file of result.missing) console.log(`  already missing: ${file}`)
    if (result.manifestRemoved) console.log(`  manifest removed: ${result.manifest}`)
  }
  const removeMcp = (location: 'local' | 'global', repo?: string): void => {
    const result = uninstallCursorMcp({
      location,
      projectRoot: repo,
      yes: flags.yes,
    })
    if (result.preservedInvalid) {
      console.log(`  preserve invalid MCP config (${location}): ${result.path}`)
    } else if (result.removed) {
      console.log(`  ${flags.yes ? 'unwired' : 'would unwire'} MCP (${location}): ${result.path}`)
    } else {
      console.log(`  MCP (${location}): no testkit entry`)
    }
  }
  const removeAllRepos = (): void => {
    const repos = repoTargets(flags)
    if (repos.length === 0) console.log('  (no registered repos; try --discover <dir>)')
    for (const repo of repos) {
      removeRepo(repo)
      if (!flags.keepMcp) removeMcp('local', repo)
    }
  }

  switch (scope) {
    case 'repo':
      removeRepo(root)
      if (!flags.keepMcp) removeMcp('local', root)
      break
    case 'all-repos':
      removeAllRepos()
      break
    case 'mcp-local':
      removeMcp('local', root)
      break
    case 'mcp-global':
      removeMcp('global')
      break
    case 'cli':
      removeCli(!flags.yes)
      break
    case 'all':
      removeAllRepos()
      removeMcp('global')
      removeCli(!flags.yes)
      if (flags.yes) {
        if (removeLedger()) console.log(`  ledger removed: ${ledgerPath()}`)
      } else {
        console.log(`  would remove ledger: ${ledgerPath()}`)
      }
      break
  }
}

async function runUninstall(defaultScope: 'repo' | 'all'): Promise<void> {
  const flags: UninstallFlags = {
    yes: has('--yes'),
    keepMcp: has('--keep-mcp'),
    projectRoot: arg('--project-root'),
    discoverDir: arg('--discover'),
  }
  let scope: UninstallScope = defaultScope
  if (defaultScope === 'all') {
    const requested = arg('--scope')
    if (requested) {
      if (!UNINSTALL_SCOPES.includes(requested as UninstallScope)) {
        throw new Error(`--scope must be one of: ${UNINSTALL_SCOPES.join(', ')}`)
      }
      scope = requested as UninstallScope
    }
  }

  if (process.stdin.isTTY && process.stdout.isTTY && !flags.yes) {
    console.log(`\nPreview (${scope}):`)
    runUninstallScope(scope, { ...flags, yes: false })
    const answer = await selectPrompt<'no' | 'yes'>({
      message:
        defaultScope === 'repo'
          ? 'Apply testkit deinit for this repo?'
          : 'Apply global testkit uninstall (all repos + MCP + CLI)?',
      defaultIndex: 0,
      choices: [
        { value: 'no', name: 'No — cancel' },
        { value: 'yes', name: 'Yes — remove now' },
      ],
    })
    if (answer === 'no') {
      console.log('Cancelled.')
      return
    }
    console.log(`\nApplying (${scope}):`)
    runUninstallScope(scope, { ...flags, yes: true })
    console.log(`\nUninstalled (${scope}).`)
    return
  }

  runUninstallScope(scope, flags)
  console.log(
    flags.yes ? `\nUninstalled (${scope}).` : `\nDry-run (${scope}) — pass --yes to apply.`,
  )
}

async function main(): Promise<void> {
  const command = process.argv[2]
  if (!command || command === 'help' || command === '--help') usage()
  if (command === 'version' || command === '--version') {
    console.log(`testkit ${packageVersion()}`)
    console.log(`packageRoot ${packageRoot()}`)
    return
  }
  if (command === 'init') {
    const type = (arg('--type') ?? 'tests') as TestkitType
    if (!['tests', 'fe'].includes(type)) throw new Error('--type must be tests | fe')
    const root = resolveProjectRoot(arg('--project-root'))
    const mcp = installCursorMcp({
      projectRoot: root,
      type,
      testsRoot: arg('--tests-root'),
      docsRoot: arg('--docs-root'),
    })
    console.log(`${mcp.written ? 'wrote' : 'unchanged'}: ${mcp.path}`)
    const harness = installHarness({ projectRoot: root, type, force: has('--force') })
    for (const file of harness.written) console.log(`  wrote: ${file}`)
    for (const file of harness.unchanged) console.log(`  unchanged: ${file}`)
    for (const file of harness.conflicts) console.log(`  conflict: ${file}`)
    const lifecycle = statusHarness({ projectRoot: root })
    if (lifecycle.stale.length > 0) {
      console.log(`stale: ${lifecycle.stale.length}`)
      console.log(`review: testkit prune --project-root ${JSON.stringify(root)}`)
    }
    return
  }

  if (command === 'deinit') {
    await runUninstall('repo')
    return
  }
  if (command === 'uninstall') {
    await runUninstall('all')
    return
  }

  const root = resolveProjectRoot(arg('--project-root'))
  if (command === 'status') {
    const status = statusHarness({ projectRoot: root })
    printStatus(status)
    if (
      !status.compatibility.compatible
      || status.missing.length > 0
      || status.modified.length > 0
      || status.stale.length > 0
    ) {
      process.exitCode = 1
    }
    return
  }
  if (command === 'prune') {
    const result = pruneHarness({ projectRoot: root, yes: has('--yes') })
    console.log(`mode: ${result.dryRun ? 'dry-run' : 'apply'}`)
    for (const file of result.candidates) {
      console.log(`  ${result.dryRun ? 'would delete' : 'deleted'}: ${file}`)
    }
    for (const file of result.preservedModified) console.log(`  preserved modified: ${file}`)
    for (const file of result.preservedProtected) console.log(`  preserved protected: ${file}`)
    for (const file of result.missing) console.log(`  missing: ${file}`)
    if (result.dryRun && result.candidates.length > 0) {
      console.log('Run again with --yes to delete unmodified stale files.')
    }
    return
  }
  const env: Record<string, string> = {}
  if (arg('--tests-root')) env.TESTKIT_TESTS_ROOT = arg('--tests-root')!
  if (arg('--docs-root')) env.TESTKIT_DOCS_ROOT = arg('--docs-root')!

  if (command === 'cases:render') {
    printResult(runEngine({ engineRel: ['cases', 'render-cases.mjs'], projectRoot: root, argv: passthrough(command), env }))
  }
  if (command === 'cases:check') {
    printResult(runEngine({ engineRel: ['cases', 'check-plans.mjs'], projectRoot: root, argv: passthrough(command), env }))
  }
  if (command === 'cases:coverage') {
    printResult(
      runEngine({ engineRel: ['cases', 'check-coverage.mjs'], projectRoot: root, argv: passthrough(command), env }),
    )
  }
  if (command === 'testcase:gen' || command === 'testcase:gen:dry') {
    const argv = passthrough(command)
    if (command.endsWith(':dry') && !argv.includes('--dry-run')) argv.push('--dry-run')
    printResult(
      runEngine({
        engineRel: ['testcase', 'runners', 'generate.mjs'],
        projectRoot: root,
        argv,
        env,
      }),
    )
  }
  if (command === 'e2e-registry') {
    printResult(
      runEngine({
        engineRel: ['testcase', 'runners', 'validate-registry.mjs'],
        projectRoot: root,
        argv: passthrough(command),
        env,
      }),
    )
  }
  usage()
}

main().catch((error) => {
  if (error instanceof Error && error.message === 'cancelled') {
    console.log('\nCancelled.')
    return
  }
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
