import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { preflightOutputPaths, writeOutputs } from '../engines/testcase/runners/lib/write-files.mjs'

const repoRoot = path.resolve('.')

function makeRoot(prefix) {
  return mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('writes valid page object and spec outputs beneath tests/e2e', async () => {
  const root = makeRoot('testkit-write-valid-')
  const outputs = [
    { relativePath: 'tests/e2e/pages/auth/LoginPage.ts', content: 'export class LoginPage {}\n' },
    { relativePath: 'tests/e2e/auth/TC-LOGIN-VALID.spec.ts', content: 'test.describe()\n' },
  ]

  const { written, skipped } = await writeOutputs(root, outputs, {})
  assert.deepEqual(written.map((item) => item.relativePath), outputs.map((item) => item.relativePath))
  assert.deepEqual(skipped, [])
  for (const { relativePath, content } of outputs) {
    assert.equal(readFileSync(path.join(root, relativePath), 'utf8'), content)
  }
})

test('rejects ".." traversal outputs', async () => {
  const root = makeRoot('testkit-write-traversal-')
  await assert.rejects(
    writeOutputs(root, [{ relativePath: 'tests/e2e/../../escape/evil.spec.ts', content: 'x' }], {}),
    /".." traversal is not allowed/,
  )
  assert.equal(existsSync(path.join(root, 'escape')), false)
  assert.equal(existsSync(path.join(root, 'tests')), false)
})

test('rejects absolute output paths', async () => {
  const root = makeRoot('testkit-write-absolute-')
  const absolute = path.join(root, 'tests', 'e2e', 'abs.spec.ts')
  await assert.rejects(
    writeOutputs(root, [{ relativePath: absolute, content: 'x' }], {}),
    /absolute paths are not allowed/,
  )
  assert.equal(existsSync(absolute), false)
})

test('rejects sibling-prefix outputs such as tests/e2e-evil', async () => {
  const root = makeRoot('testkit-write-sibling-')
  await assert.rejects(
    writeOutputs(root, [{ relativePath: 'tests/e2e-evil/evil.spec.ts', content: 'x' }], {}),
    /resolves outside tests\/e2e\//,
  )
  assert.equal(existsSync(path.join(root, 'tests')), false)
})

test('rejects existing symlink ancestors without following them', async () => {
  const root = makeRoot('testkit-write-symlink-')
  const outside = makeRoot('testkit-write-symlink-outside-')
  mkdirSync(path.join(root, 'tests'))
  symlinkSync(outside, path.join(root, 'tests', 'e2e'))

  await assert.rejects(
    writeOutputs(root, [{ relativePath: 'tests/e2e/auth/evil.spec.ts', content: 'x' }], {}),
    /ancestor "tests\/e2e" is a symlink/,
  )
  assert.equal(existsSync(path.join(outside, 'auth')), false)
})

test('rejects existing symlink targets', async () => {
  const root = makeRoot('testkit-write-symlink-target-')
  const outsideFile = path.join(makeRoot('testkit-write-symlink-target-outside-'), 'redirect.ts')
  writeFileSync(outsideFile, 'original\n')
  mkdirSync(path.join(root, 'tests', 'e2e', 'auth'), { recursive: true })
  symlinkSync(outsideFile, path.join(root, 'tests', 'e2e', 'auth', 'link.spec.ts'))

  await assert.rejects(
    writeOutputs(root, [{ relativePath: 'tests/e2e/auth/link.spec.ts', content: 'x' }], { force: true }),
    /target "tests\/e2e\/auth\/link\.spec\.ts" is a symlink/,
  )
  assert.equal(readFileSync(outsideFile, 'utf8'), 'original\n')
})

test('a rejected multi-output batch writes nothing', async () => {
  const root = makeRoot('testkit-write-batch-')
  const valid = 'tests/e2e/auth/TC-OK.spec.ts'
  await assert.rejects(
    writeOutputs(
      root,
      [
        { relativePath: valid, content: 'ok' },
        { relativePath: 'tests/e2e/../../escape/evil.spec.ts', content: 'x' },
      ],
      {},
    ),
    /nothing was written/,
  )
  assert.equal(existsSync(path.join(root, valid)), false)
  assert.equal(existsSync(path.join(root, 'escape')), false)
})

test('dry-run is subject to the same containment validation', async () => {
  const root = makeRoot('testkit-write-dry-')
  await assert.rejects(
    writeOutputs(root, [{ relativePath: '../outside.spec.ts', content: 'x' }], { dryRun: true }),
    /".." traversal is not allowed/,
  )

  const { written } = await writeOutputs(
    root,
    [{ relativePath: 'tests/e2e/auth/TC-DRY.spec.ts', content: 'x' }],
    { dryRun: true },
  )
  assert.deepEqual(written, [{ relativePath: 'tests/e2e/auth/TC-DRY.spec.ts', dryRun: true }])
  assert.equal(existsSync(path.join(root, 'tests')), false)
})

test('preflight reports every violation with actionable guidance', async () => {
  const root = makeRoot('testkit-write-report-')
  await assert.rejects(
    preflightOutputPaths(root, [
      { relativePath: '/abs/evil.ts' },
      { relativePath: 'tests/e2e-evil/x.ts' },
      { relativePath: 'src/pages/Login.ts' },
    ]),
    (error) => {
      assert.match(error.message, /3 unsafe output path\(s\)/)
      assert.match(error.message, /absolute paths are not allowed/)
      assert.match(error.message, /"tests\/e2e-evil\/x\.ts": resolves outside tests\/e2e\//)
      assert.match(error.message, /"src\/pages\/Login\.ts": resolves outside tests\/e2e\//)
      return true
    },
  )
})

test('engine rejects a malicious testcase fixture and writes nothing', () => {
  const root = makeRoot('testkit-engine-evil-')
  mkdirSync(path.join(root, 'registries'), { recursive: true })
  writeFileSync(path.join(root, 'registries', 'e2e-test.registry.json'), '{}\n')

  const fixture = path.join(repoRoot, 'test', 'fixtures', 'TC-EVIL-TRAVERSAL.yaml')
  for (const extraArgs of [[], ['--dry-run']]) {
    const result = spawnSync(
      process.execPath,
      ['engines/testcase/runners/generate.mjs', '--testcase', fixture, ...extraArgs],
      { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, TESTKIT_ROOT: root } },
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /refusing to write/)
    assert.match(result.stderr, /".." traversal is not allowed/)
  }
  assert.equal(existsSync(path.join(root, 'tests')), false)
  assert.equal(existsSync(path.join(root, 'escape')), false)
})
