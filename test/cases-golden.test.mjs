import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve('.')
const fixtureRoot = path.join(repoRoot, 'test', 'fixtures', 'cases')
const golden = JSON.parse(
  readFileSync(path.join(repoRoot, 'test', 'golden', 'cases-render-coverage.json'), 'utf8'),
)
const renderEngine = path.join(repoRoot, 'engines', 'cases', 'render-cases.mjs')
const coverageEngine = path.join(repoRoot, 'engines', 'cases', 'check-coverage.mjs')

function makeFixture({ gap = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'testkit-cases-golden-'))
  cpSync(fixtureRoot, root, { recursive: true })
  if (gap) {
    rmSync(path.join(root, 'cases', 'W-AUTH-001', 'TC-AUTH-VALIDATION.yaml'))
  }
  return root
}

function localOnlyEnv() {
  const env = { ...process.env }
  delete env.TESTKIT_DOCS_ROOT
  delete env.CODEGENKIT_DOCS_ROOT
  delete env.TESTKIT_TESTS_ROOT
  delete env.ARTIFACTGRAPH_URL
  delete env.ARTIFACTGRAPH_TOKEN
  return env
}

function run(engine, root) {
  return spawnSync(process.execPath, [engine], {
    cwd: root,
    encoding: 'utf8',
    env: localOnlyEnv(),
  })
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

test('cases render matches deterministic portable golden output', () => {
  const root = makeFixture()
  const result = run(renderEngine, root)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, golden.render.stdout)
  assert.equal(result.stderr, '')
  assert.doesNotMatch(result.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  for (const [relativePath, hash] of Object.entries(golden.render.files)) {
    const output = path.join(root, relativePath)
    assert.equal(existsSync(output), true)
    const content = readFileSync(output, 'utf8')
    assert.equal(sha256(content), hash)
    assert.doesNotMatch(content, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('cases coverage passes through deterministic local fallback', () => {
  const root = makeFixture()
  const result = run(coverageEngine, root)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, golden.coverageHappy.stdout)
  assert.equal(result.stderr, '')
  assert.doesNotMatch(result.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('cases coverage reports the golden missing-facet gap locally', () => {
  const root = makeFixture({ gap: true })
  const result = run(coverageEngine, root)
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, golden.coverageGap.stderr)
  assert.doesNotMatch(result.stderr, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
