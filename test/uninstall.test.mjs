import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.TESTKIT_STATE_DIR = mkdtempSync(path.join(os.tmpdir(), 'testkit-state-'))

const {
  INSTALL_MANIFEST_PATH,
  discoverInstalls,
  installHarness,
  ledgerPath,
  pruneHarness,
  readLedger,
  uninstallHarness,
} = await import('../dist/index.js')
const { uninstallCursorMcp } = await import('../dist/install/cursor-mcp.js')

function tempDir(name) {
  return mkdtempSync(path.join(os.tmpdir(), `testkit-uninstall-${name}-`))
}

test('install ledger records, discovers, and forgets Testkit destinations', () => {
  const base = tempDir('ledger')
  const root = path.join(base, 'nested', 'tests-hub')
  mkdirSync(root, { recursive: true })
  installHarness({ projectRoot: root, type: 'tests' })

  assert.ok(readLedger().includes(root))
  assert.ok(discoverInstalls(base).includes(root))
  uninstallHarness({ projectRoot: root, yes: true })

  const persisted = JSON.parse(readFileSync(ledgerPath(), 'utf8'))
  assert.equal(persisted.repos.includes(root), false)
})

test('uninstall is dry-run by default and preserves modified files', () => {
  const root = tempDir('modified')
  const installed = installHarness({ projectRoot: root, type: 'tests' })
  const modified = installed.written[0]
  writeFileSync(modified, `${readFileSync(modified, 'utf8')}\n# member edit\n`)

  const dryRun = uninstallHarness({ projectRoot: root })
  assert.equal(dryRun.dryRun, true)
  assert.ok(dryRun.wouldDelete.includes(INSTALL_MANIFEST_PATH))
  assert.ok(existsSync(path.join(root, INSTALL_MANIFEST_PATH)))

  const applied = uninstallHarness({ projectRoot: root, yes: true })
  assert.ok(applied.preservedModified.includes(path.relative(root, modified)))
  assert.equal(existsSync(modified), true)
  assert.equal(existsSync(path.join(root, INSTALL_MANIFEST_PATH)), false)
})

test('uninstall and prune never remove ArtifactGraph-owned assets', () => {
  const root = tempDir('artifactgraph')
  installHarness({ projectRoot: root, type: 'tests' })
  const manifestPath = path.join(root, INSTALL_MANIFEST_PATH)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const protectedRel = '.cursor/skills/artifactgraph-query/SKILL.md'
  const protectedFile = path.join(root, protectedRel)
  mkdirSync(path.dirname(protectedFile), { recursive: true })
  writeFileSync(protectedFile, 'artifactgraph owned\n')
  manifest.files[protectedRel] = {
    source: 'external/artifactgraph',
    sha256: createHash('sha256').update('artifactgraph owned\n').digest('hex'),
    stale: true,
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const pruned = pruneHarness({ projectRoot: root, yes: true })
  assert.ok(pruned.preservedProtected.includes(protectedRel))
  assert.equal(existsSync(protectedFile), true)

  const removed = uninstallHarness({ projectRoot: root, yes: true })
  assert.ok(removed.preservedProtected.includes(protectedRel))
  assert.equal(existsSync(protectedFile), true)
})

test('Cursor MCP uninstall removes only Testkit from shared config', () => {
  const root = tempDir('mcp')
  const file = path.join(root, '.cursor', 'mcp.json')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(
    file,
    `${JSON.stringify({
      mcpServers: {
        testkit: { command: 'testkit' },
        artifactgraph: { command: 'artifactgraph' },
        member: { command: 'member' },
      },
      setting: true,
    }, null, 2)}\n`,
  )

  const dryRun = uninstallCursorMcp({ location: 'local', projectRoot: root })
  assert.equal(dryRun.removed, true)
  assert.ok(JSON.parse(readFileSync(file, 'utf8')).mcpServers.testkit)

  uninstallCursorMcp({ location: 'local', projectRoot: root, yes: true })
  const after = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal('testkit' in after.mcpServers, false)
  assert.ok(after.mcpServers.artifactgraph)
  assert.ok(after.mcpServers.member)
  assert.equal(after.setting, true)
})

test('CLI deinit is repo-local and uninstall defaults to global dry-run', () => {
  const root = tempDir('cli-deinit')
  const cli = path.resolve('bin/testkit.mjs')
  installHarness({ projectRoot: root, type: 'tests' })
  const env = { ...process.env, TESTKIT_STATE_DIR: process.env.TESTKIT_STATE_DIR }
  const deinit = spawnSync(
    process.execPath,
    [cli, 'deinit', '--project-root', root, '--yes'],
    { cwd: path.resolve('.'), encoding: 'utf8', env },
  )
  assert.equal(deinit.status, 0, deinit.stderr)
  assert.match(deinit.stdout, /Uninstalled \(repo\)/)
  assert.equal(existsSync(path.join(root, INSTALL_MANIFEST_PATH)), false)

  const fakeHome = tempDir('cli-home')
  const global = spawnSync(process.execPath, [cli, 'uninstall'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...env,
      HOME: fakeHome,
      TESTKIT_STATE_DIR: tempDir('cli-state'),
      TESTKIT_INSTALL_DIR: path.join(fakeHome, '.testkit'),
      TESTKIT_BIN_DIR: path.join(fakeHome, '.local', 'bin'),
      TESTKIT_GLOBAL_MCP_FILE: path.join(fakeHome, '.cursor', 'mcp.json'),
    },
  })
  assert.equal(global.status, 0, global.stderr)
  assert.match(global.stdout, /Dry-run \(all\)/)
})

test('global uninstall applies all tracked lifecycle removals from any directory', () => {
  const cli = path.resolve('bin/testkit.mjs')
  const state = tempDir('global-state')
  const previousState = process.env.TESTKIT_STATE_DIR
  process.env.TESTKIT_STATE_DIR = state
  const root = tempDir('global-repo')
  installHarness({ projectRoot: root, type: 'tests' })

  const localMcp = path.join(root, '.cursor', 'mcp.json')
  writeFileSync(
    localMcp,
    `${JSON.stringify({ mcpServers: { testkit: {}, artifactgraph: {} } }, null, 2)}\n`,
  )
  const home = tempDir('global-home')
  const globalMcp = path.join(home, '.cursor', 'mcp.json')
  mkdirSync(path.dirname(globalMcp), { recursive: true })
  writeFileSync(
    globalMcp,
    `${JSON.stringify({ mcpServers: { testkit: {}, artifactgraph: {} } }, null, 2)}\n`,
  )
  const installDir = path.join(home, '.testkit')
  const binDir = path.join(home, '.local', 'bin')
  mkdirSync(installDir, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  writeFileSync(path.join(installDir, 'marker'), 'installed\n')
  writeFileSync(path.join(binDir, 'testkit'), 'link placeholder\n')
  writeFileSync(path.join(binDir, 'testkit-mcp'), 'link placeholder\n')
  const elsewhere = tempDir('global-cwd')

  const result = spawnSync(process.execPath, [cli, 'uninstall', '--yes'], {
    cwd: elsewhere,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      TESTKIT_STATE_DIR: state,
      TESTKIT_INSTALL_DIR: installDir,
      TESTKIT_BIN_DIR: binDir,
      TESTKIT_GLOBAL_MCP_FILE: globalMcp,
    },
  })
  if (previousState === undefined) delete process.env.TESTKIT_STATE_DIR
  else process.env.TESTKIT_STATE_DIR = previousState

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Uninstalled \(all\)/)
  assert.equal(existsSync(path.join(root, INSTALL_MANIFEST_PATH)), false)
  assert.equal('testkit' in JSON.parse(readFileSync(localMcp, 'utf8')).mcpServers, false)
  assert.ok(JSON.parse(readFileSync(localMcp, 'utf8')).mcpServers.artifactgraph)
  assert.equal('testkit' in JSON.parse(readFileSync(globalMcp, 'utf8')).mcpServers, false)
  assert.ok(JSON.parse(readFileSync(globalMcp, 'utf8')).mcpServers.artifactgraph)
  assert.equal(existsSync(installDir), false)
  assert.equal(existsSync(path.join(binDir, 'testkit')), false)
  assert.equal(existsSync(path.join(state, 'installs.json')), false)
})

test('prune ignores unmarked non-profile inventory', () => {
  const root = tempDir('prune-stale-only')
  installHarness({ projectRoot: root, type: 'tests' })
  const manifestPath = path.join(root, INSTALL_MANIFEST_PATH)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const rel = '.cursor/skills/member-owned/SKILL.md'
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, 'member\n')
  manifest.files[rel] = {
    source: 'legacy/member',
    sha256: createHash('sha256').update('member\n').digest('hex'),
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const result = pruneHarness({ projectRoot: root, yes: true })
  assert.equal(result.deleted.includes(rel), false)
  assert.equal(existsSync(file), true)
})
