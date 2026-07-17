import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { installHarness, SKILLS_BY_TYPE } from '../dist/install/harness.js'
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

test('testcase engine no longer imports sibling codegen path', () => {
  const gen = readFileSync('engines/testcase/runners/generate.mjs', 'utf8')
  assert.match(gen, /TESTKIT_ROOT/)
  assert.doesNotMatch(gen, /\.\.\/\.\.\/codegen\//)
})
