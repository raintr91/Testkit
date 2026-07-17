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

import { readTestcaseFile } from '../engines/testcase/runners/lib/read-testcase.mjs'
import { resolveHubId } from '../engines/testcase/runners/lib/resolve-hub-id.mjs'

const repoRoot = path.resolve('.')
const fixture = path.join(repoRoot, 'test', 'fixtures', 'TC-PORTABLE-LOGIN.yaml')
const golden = JSON.parse(
  readFileSync(path.join(repoRoot, 'test', 'golden', 'TC-PORTABLE-LOGIN.json'), 'utf8'),
)

function makeRoot(prefix) {
  const root = mkdtempSync(path.join(os.tmpdir(), prefix))
  mkdirSync(path.join(root, 'registries'), { recursive: true })
  writeFileSync(path.join(root, 'registries', 'e2e-test.registry.json'), '{}\n')
  return root
}

function withoutDocsEnv(extra = {}) {
  const env = { ...process.env, ...extra }
  delete env.TESTKIT_DOCS_ROOT
  delete env.CODEGENKIT_DOCS_ROOT
  return env
}

function runGenerator(root, args, extraEnv = {}) {
  return spawnSync(
    process.execPath,
    ['engines/testcase/runners/generate.mjs', ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: withoutDocsEnv({ TESTKIT_ROOT: root, ...extraEnv }),
    },
  )
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function makeTestsHub() {
  const testsRoot = mkdtempSync(path.join(os.tmpdir(), 'testkit-tests-hub-'))
  const screen = 'W-AUTH-001'
  const casesDir = path.join(testsRoot, 'cases', screen)
  mkdirSync(path.join(testsRoot, 'registries'), { recursive: true })
  mkdirSync(path.join(testsRoot, 'suites'), { recursive: true })
  mkdirSync(casesDir, { recursive: true })

  const source = readFileSync(fixture, 'utf8')
  const first = path.join(casesDir, 'TC-PORTABLE-LOGIN.yaml')
  const second = path.join(casesDir, 'TC-PORTABLE-LOGIN-ALT.yaml')
  writeFileSync(first, source)
  writeFileSync(second, source.replaceAll('TC-PORTABLE-LOGIN', 'TC-PORTABLE-LOGIN-ALT'))
  writeFileSync(
    path.join(testsRoot, 'suites', 'smoke.yaml'),
    'id: smoke\ncases:\n  - TC-PORTABLE-LOGIN\n  - TC-PORTABLE-LOGIN-ALT\n',
  )
  writeFileSync(
    path.join(testsRoot, 'registries', 'tests-index.json'),
    `${JSON.stringify({
      version: 1,
      codeIds: {
        [screen]: `cases/${screen}`,
        'TC-PORTABLE-LOGIN': `cases/${screen}/TC-PORTABLE-LOGIN.yaml`,
        'TC-PORTABLE-LOGIN-ALT': `cases/${screen}/TC-PORTABLE-LOGIN-ALT.yaml`,
      },
      suites: { smoke: 'suites/smoke.yaml' },
      scenarios: {},
    }, null, 2)}\n`,
  )
  return { testsRoot, first }
}

test('tests-only id lookup is lazy and does not require a docs hub', () => {
  const root = makeRoot('testkit-resolve-no-docs-')
  const { testsRoot, first } = makeTestsHub()
  const previousTestsRoot = process.env.TESTKIT_TESTS_ROOT
  const previousDocsRoot = process.env.TESTKIT_DOCS_ROOT
  const previousLegacyDocsRoot = process.env.CODEGENKIT_DOCS_ROOT
  process.env.TESTKIT_TESTS_ROOT = testsRoot
  delete process.env.TESTKIT_DOCS_ROOT
  delete process.env.CODEGENKIT_DOCS_ROOT

  try {
    assert.deepEqual(resolveHubId(root, 'TC-PORTABLE-LOGIN', 'testcase').paths, [first])
    assert.equal(resolveHubId(root, 'W-AUTH-001', 'testcase').paths.length, 2)
    assert.equal(resolveHubId(root, 'smoke', 'testcase').paths.length, 2)
  } finally {
    if (previousTestsRoot === undefined) delete process.env.TESTKIT_TESTS_ROOT
    else process.env.TESTKIT_TESTS_ROOT = previousTestsRoot
    if (previousDocsRoot === undefined) delete process.env.TESTKIT_DOCS_ROOT
    else process.env.TESTKIT_DOCS_ROOT = previousDocsRoot
    if (previousLegacyDocsRoot === undefined) delete process.env.CODEGENKIT_DOCS_ROOT
    else process.env.CODEGENKIT_DOCS_ROOT = previousLegacyDocsRoot
  }
})

test('direct testcase reads warn once and retain testcase-only context', async () => {
  const root = makeRoot('testkit-read-no-docs-')
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  try {
    const first = await readTestcaseFile(fixture, { repoRoot: root })
    const retry = await readTestcaseFile(fixture, { repoRoot: root })
    assert.equal(first.spec, null)
    assert.equal(first.specFile, null)
    assert.equal(retry.testcase.id, 'TC-PORTABLE-LOGIN')
  } finally {
    console.warn = originalWarn
  }
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /optional docs enrichment unavailable/)
  assert.match(warnings[0], /generation continues/)
  assert.match(warnings[0], /TESTKIT_DOCS_ROOT/)
})

test('malformed testcase YAML remains fatal without a docs hub', async () => {
  const root = makeRoot('testkit-malformed-no-docs-')
  const malformed = path.join(root, 'TC-MALFORMED.yaml')
  writeFileSync(malformed, 'id: TC-MALFORMED\nrefs: [unterminated\n')
  await assert.rejects(readTestcaseFile(malformed, { repoRoot: root }), /Flow sequence in block collection/)
})

test('explicit testcase generation is portable and matches golden output', () => {
  const roots = [makeRoot('testkit-golden-a-'), makeRoot('testkit-golden-b-')]
  const outputs = roots.map((root) => {
    const result = runGenerator(root, ['--testcase', fixture])
    assert.equal(result.status, 0, result.stderr)
    assert.equal((result.stderr.match(/optional docs enrichment unavailable/g) ?? []).length, 1)
    const files = Object.keys(golden.files).sort()
    const contents = Object.fromEntries(
      files.map((relativePath) => {
        const absolute = path.join(root, relativePath)
        assert.equal(existsSync(absolute), true)
        const content = readFileSync(absolute, 'utf8')
        assert.equal(sha256(content), golden.files[relativePath])
        assert.doesNotMatch(content, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        return [relativePath, content]
      }),
    )
    return contents
  })
  assert.deepEqual(outputs[0], outputs[1])
})

test('batch dry-run without docs topology succeeds and warns exactly once', () => {
  const root = makeRoot('testkit-batch-no-docs-')
  const { testsRoot } = makeTestsHub()
  const result = runGenerator(root, ['--id', 'W-AUTH-001', '--dry-run'], {
    TESTKIT_TESTS_ROOT: testsRoot,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /2 file\(s\)/)
  assert.equal((result.stderr.match(/optional docs enrichment unavailable/g) ?? []).length, 1)
  assert.equal(existsSync(path.join(root, 'tests')), false)
})
