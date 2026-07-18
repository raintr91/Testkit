import {
  packageRoot,
  packageVersion,
  resolveProjectRoot,
  type TestkitType,
} from './config/project-root.js'
import { installCursorMcp } from './install/cursor-mcp.js'
import {
  installHarness,
  pruneHarness,
  SKILLS_BY_TYPE,
  statusHarness,
  type HarnessStatus,
} from './install/harness.js'
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
  prune [--project-root <path>] [--yes]
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
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
