import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  installHarness,
  pruneHarness,
  SKILLS_BY_TYPE,
  statusHarness,
} from '../dist/index.js'
import { mergePlatformRepos } from '../dist/install/platform-repos.js'
import { installCursorMcp } from '../dist/install/cursor-mcp.js'

test('tests profile syncs plan skills only', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-tests-'))
  installHarness({ projectRoot: root, type: 'tests' })
  mergePlatformRepos({ projectRoot: root, type: 'tests' })
  for (const skill of SKILLS_BY_TYPE.tests) {
    assert.ok(existsSync(path.join(root, '.cursor', 'skills', skill, 'SKILL.md')))
  }
  assert.equal(existsSync(path.join(root, '.cursor', 'skills', 'test', 'SKILL.md')), false)
  const platform = JSON.parse(readFileSync(path.join(root, 'platform-repos.json'), 'utf8'))
  assert.deepEqual(platform.harness.profiles.tests.skills, SKILLS_BY_TYPE.tests)
})

test('fe profile syncs playwright skills only and keeps explicit roots', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-fe-'))
  installHarness({ projectRoot: root, type: 'fe' })
  const mcp = installCursorMcp({
    projectRoot: root,
    type: 'fe',
    testsRoot: '/tmp/tests-hub',
    docsRoot: '/tmp/docs-hub',
  })
  const cfg = JSON.parse(readFileSync(mcp.path, 'utf8'))
  assert.equal(cfg.mcpServers.testkit.env.TESTKIT_TESTS_ROOT, '/tmp/tests-hub')
  assert.equal(cfg.mcpServers.testkit.env.TESTKIT_DOCS_ROOT, '/tmp/docs-hub')
  assert.ok(existsSync(path.join(root, '.cursor', 'skills', 'test', 'SKILL.md')))
  assert.equal(existsSync(path.join(root, '.cursor', 'skills', 'testcase', 'SKILL.md')), false)
})

test('status reports healthy, missing, modified, stale, and compatibility buckets', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-status-'))
  installHarness({ projectRoot: root, type: 'tests' })
  installHarness({ projectRoot: root, type: 'fe' })

  const missing = '.cursor/skills/test/SKILL.md'
  const modified = '.cursor/skills/grill-test/SKILL.md'
  rmSync(path.join(root, missing))
  writeFileSync(path.join(root, modified), '# local edit\n')

  const status = statusHarness({ projectRoot: root })
  assert.equal(status.installed, true)
  assert.equal(status.type, 'fe')
  assert.deepEqual(status.compatibility, { compatible: true, issues: [] })
  assert.ok(status.missing.includes(missing))
  assert.ok(status.modified.includes(modified))
  assert.ok(status.stale.includes('.cursor/skills/testcase/SKILL.md'))
  assert.ok(status.stale.includes('.cursor/skills/grill-testcase/SKILL.md'))

  const manifest = JSON.parse(
    readFileSync(path.join(root, '.testkit', 'install-manifest.json'), 'utf8'),
  )
  assert.equal(manifest.files['.cursor/skills/testcase/SKILL.md'].stale, true)
  assert.equal(manifest.files['.cursor/skills/grill-testcase/SKILL.md'].stale, true)
  assert.equal(manifest.files[missing].stale, undefined)
})

test('prune is dry-run by default and --yes preserves modified stale files', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-prune-'))
  installHarness({ projectRoot: root, type: 'tests' })
  const unmodified = '.cursor/skills/testcase/SKILL.md'
  const modified = '.cursor/skills/grill-testcase/SKILL.md'
  const unmanaged = '.cursor/skills/testcase/LOCAL.md'
  installHarness({ projectRoot: root, type: 'fe' })
  writeFileSync(path.join(root, modified), '# keep my local version\n')
  writeFileSync(path.join(root, unmanaged), '# not managed by Testkit\n', { flush: true })

  const dryRun = pruneHarness({ projectRoot: root })
  assert.equal(dryRun.dryRun, true)
  assert.ok(dryRun.candidates.includes(unmodified))
  assert.ok(dryRun.preservedModified.includes(modified))
  assert.equal(existsSync(path.join(root, unmodified)), true)
  assert.equal(existsSync(path.join(root, modified)), true)

  const applied = pruneHarness({ projectRoot: root, yes: true })
  assert.equal(applied.dryRun, false)
  assert.ok(applied.deleted.includes(unmodified))
  assert.ok(applied.preservedModified.includes(modified))
  assert.equal(existsSync(path.join(root, unmodified)), false)
  assert.equal(readFileSync(path.join(root, modified), 'utf8'), '# keep my local version\n')
  assert.equal(readFileSync(path.join(root, unmanaged), 'utf8'), '# not managed by Testkit\n')

  const manifest = JSON.parse(
    readFileSync(path.join(root, '.testkit', 'install-manifest.json'), 'utf8'),
  )
  assert.equal(manifest.files[unmodified], undefined)
  assert.equal(manifest.files[modified].stale, true)
})

test('incompatible manifests are reported and block prune writes', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-incompatible-'))
  installHarness({ projectRoot: root, type: 'tests' })
  installHarness({ projectRoot: root, type: 'fe' })
  const manifestPath = path.join(root, '.testkit', 'install-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.toolApi = 2
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  const stale = path.join(root, '.cursor', 'skills', 'testcase', 'SKILL.md')

  const status = statusHarness({ projectRoot: root })
  assert.equal(status.compatibility.compatible, false)
  assert.match(status.compatibility.issues.join('\n'), /unsupported toolApi: 2/)
  assert.throws(
    () => pruneHarness({ projectRoot: root, yes: true }),
    /Incompatible Testkit install manifest/,
  )
  assert.equal(existsSync(stale), true)
})

test('CLI status and prune expose lifecycle behavior', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-cli-'))
  installHarness({ projectRoot: root, type: 'tests' })
  installHarness({ projectRoot: root, type: 'fe' })

  const status = spawnSync(
    process.execPath,
    ['bin/testkit.mjs', 'status', '--project-root', root],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  )
  assert.equal(status.status, 1)
  assert.match(status.stdout, /compatibility: compatible/)
  assert.match(status.stdout, /stale: [1-9]\d*/)

  const prune = spawnSync(
    process.execPath,
    ['bin/testkit.mjs', 'prune', '--project-root', root],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  )
  assert.equal(prune.status, 0)
  assert.match(prune.stdout, /mode: dry-run/)
  assert.match(prune.stdout, /Run again with --yes/)
  assert.equal(existsSync(path.join(root, '.cursor', 'skills', 'testcase', 'SKILL.md')), true)

  const applied = spawnSync(
    process.execPath,
    ['bin/testkit.mjs', 'prune', '--project-root', root, '--yes'],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  )
  assert.equal(applied.status, 0)
  assert.match(applied.stdout, /mode: apply/)
  assert.match(applied.stdout, /deleted:/)
  assert.equal(existsSync(path.join(root, '.cursor', 'skills', 'testcase', 'SKILL.md')), false)
})

test('testcase engine no longer imports sibling codegen path', () => {
  const gen = readFileSync('engines/testcase/runners/generate.mjs', 'utf8')
  assert.match(gen, /TESTKIT_ROOT/)
  assert.doesNotMatch(gen, /\.\.\/\.\.\/codegen\//)
})
