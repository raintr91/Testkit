import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'
import { resolveFeatureDir } from './read-spec.mjs'
import { resolveHubId, resolveProjectRoot } from './resolve-hub-id.mjs'

/**
 * Normalize hub R3 cases for testcase:gen.
 * Supports coverage[] (R3.2), testData→data, a11y / #e2e:a11y-wcag.
 * @param {Record<string, unknown>} testcase
 */
export function normalizeTestcaseForGen(testcase) {
  const out = { ...testcase }

  if (Array.isArray(out.coverage) && out.coverage.length) {
    out._coverage = [...out.coverage]
  }

  if (out.genType === 'e2e' || out.type === 'e2e') {
    if (out.type && out.type !== 'e2e') out._taxonomyType = out.type
    out.type = 'e2e'
  } else if (out.type && out.type !== 'e2e') {
    if (
      out.genType === 'e2e' ||
      out.refs?.screen ||
      out.automation === 'automated' ||
      out._coverage
    ) {
      out._taxonomyType = out.type
      out.type = 'e2e'
    }
  }
  if (!out.type && (out.genType === 'e2e' || out._coverage || out.refs?.screen)) {
    out.type = 'e2e'
  }
  if (!out.type) out.type = 'e2e'

  if (!out.feature && out.refs?.screen) {
    out.feature = String(out.refs.screen).toLowerCase().replace(/_/g, '-')
  }
  if (!out.route) {
    out.route = { path: '/login', auth: 'guest' }
  }

  if (!out.data && out.testData && typeof out.testData === 'object') {
    out.data = out.testData
  }

  const needsA11y =
    Boolean(out.a11y) ||
    (Array.isArray(out.coverage) && out.coverage.includes('accessibility')) ||
    (Array.isArray(out.tags) &&
      out.tags.some((t) => String(t).includes('a11y-wcag') || String(t) === 'a11y'))

  if (!out.tags) out.tags = ['#e2e:semantic-smoke']
  else if (Array.isArray(out.tags) && !out.tags.some((t) => String(t).startsWith('#e2e'))) {
    out.tags = [...out.tags, '#e2e:semantic-smoke']
  }

  if (needsA11y) {
    const hasA11yTag = out.tags.some(
      (t) => String(t).includes('a11y-wcag') || String(t) === '#e2e:a11y-wcag',
    )
    if (!hasA11yTag) out.tags = [...out.tags, '#e2e:a11y-wcag']

    out.assertions = { ...(out.assertions || {}) }
    out.assertions.semantic = { ...(out.assertions.semantic || {}) }
    if (!Array.isArray(out.assertions.semantic.accessibility)) {
      out.assertions.semantic.accessibility = ['toHaveNoA11yViolations']
    }
  }

  if (typeof out.expected === 'string') {
    out.expected = [out.expected]
  }
  if (!out.expected) out.expected = []
  if (!out.assertions && out.testIds) {
    out.assertions = {
      semantic: {
        ready: {
          waitForTestIds: out.testIds.required ?? [],
        },
      },
    }
  }
  if (!out.steps) out.steps = []
  return out
}

/**
 * Resolve design ir/spec.yaml from refs.screen (base-docs) for enrichment.
 * @param {string} repoRoot
 * @param {Record<string, unknown>} testcase
 */
async function loadDesignSpec(repoRoot, testcase) {
  const screen = testcase.refs?.screen
  if (!screen || typeof screen !== 'string') return { spec: null, specFile: null, featureDir: null }
  try {
    const resolved = resolveHubId(repoRoot, screen, 'codegen')
    const abs = resolved.paths?.[0]
    if (!abs) return { spec: null, specFile: null, featureDir: null }
    const raw = await readFile(abs, 'utf8')
    const spec = parse(raw) ?? {}
    return {
      spec,
      specFile: path.relative(repoRoot, abs),
      featureDir: resolveFeatureDir(abs),
    }
  } catch {
    return { spec: null, specFile: null, featureDir: null }
  }
}

/**
 * @param {string} testcasePath
 * @param {{ repoRoot?: string }} [opts]
 */
export async function readTestcaseFile(testcasePath, opts = {}) {
  const repoRoot = opts.repoRoot ? path.resolve(opts.repoRoot) : process.cwd()
  const absolute = path.resolve(testcasePath)
  const raw = await readFile(absolute, 'utf8')
  let testcase = parse(raw) ?? {}
  testcase = normalizeTestcaseForGen(testcase)

  if (!testcase.id) {
    throw new Error(`Missing id in ${testcasePath}`)
  }
  // After normalize, type should be e2e for gen; taxonomy kept in _taxonomyType
  if (testcase.type && testcase.type !== 'e2e') {
    throw new Error(`testcase:gen only supports e2e gen — got "${testcase.type}" in ${testcasePath}`)
  }

  const design = await loadDesignSpec(repoRoot, testcase)
  const casesDir = path.dirname(absolute)

  return {
    testcase,
    testcaseFile: path.relative(repoRoot, absolute),
    featureDir: path.relative(repoRoot, design.featureDir ?? casesDir),
    specFile: design.specFile,
    spec: design.spec,
  }
}

/**
 * List TC-*.yaml under base-tests/cases/{screenId}/ (prefer --id).
 * @param {string} root FE repo root
 * @param {string} screenId e.g. W-AD-AUTH-001
 */
export async function listFeatureTestcases(root, screenId) {
  const testsRoot = process.env.TESTKIT_TESTS_ROOT ? path.resolve(process.env.TESTKIT_TESTS_ROOT) : resolveProjectRoot(root, 'tests')
  const screenDir = path.join(testsRoot, 'cases', screenId)
  const files = []
  let entries = []
  try {
    entries = await readdir(screenDir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    if (entry.isFile() && /^TC-.*\.ya?ml$/i.test(entry.name)) {
      files.push(path.join(screenDir, entry.name))
    }
  }
  return files.sort()
}
