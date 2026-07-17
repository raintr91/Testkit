import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const E2E_OUTPUT_ROOT = path.join('tests', 'e2e')

/**
 * Preflight every output path before any write or dry-run result is produced.
 *
 * A target is accepted only when, lexically (without following symlinks), it
 * resolves strictly beneath `<root>/tests/e2e`. Rejected: absolute paths,
 * `..` traversal, targets outside `tests/e2e` (including sibling prefixes
 * such as `tests/e2e-evil`), existing symlink ancestors that could redirect
 * the write, and existing targets that are not regular files.
 *
 * Throws with every violation listed; callers must write nothing on failure.
 *
 * @param {string} root project root
 * @param {{ relativePath: string }[]} outputs
 */
export async function preflightOutputPaths(root, outputs) {
  const resolvedRoot = path.resolve(root)
  const e2eRoot = path.join(resolvedRoot, E2E_OUTPUT_ROOT)
  const errors = []

  for (const { relativePath } of outputs) {
    const label = JSON.stringify(relativePath ?? null)

    if (typeof relativePath !== 'string' || !relativePath.trim()) {
      errors.push(`output ${label}: path must be a non-empty string`)
      continue
    }
    if (path.isAbsolute(relativePath)) {
      errors.push(
        `output ${label}: absolute paths are not allowed — use a path relative to the project root, under ${E2E_OUTPUT_ROOT}/`,
      )
      continue
    }

    if (relativePath.split(/[\\/]+/).includes('..')) {
      errors.push(
        `output ${label}: ".." traversal is not allowed — outputs must stay under ${E2E_OUTPUT_ROOT}/`,
      )
      continue
    }

    const absolutePath = path.resolve(resolvedRoot, relativePath)
    if (!absolutePath.startsWith(e2eRoot + path.sep)) {
      errors.push(
        `output ${label}: resolves outside ${E2E_OUTPUT_ROOT}/ — generated files must live beneath <projectRoot>/${E2E_OUTPUT_ROOT}` +
          ' (check module/testcase ids used to build output paths)',
      )
      continue
    }

    const symlinkIssue = await findUnsafePathComponent(resolvedRoot, absolutePath)
    if (symlinkIssue) errors.push(`output ${label}: ${symlinkIssue}`)
  }

  if (errors.length) {
    throw new Error(
      `testcase-gen: refusing to write — ${errors.length} unsafe output path(s), nothing was written:\n` +
        errors.map((message) => `  - ${message}`).join('\n'),
    )
  }
}

/**
 * Walk each existing path component from root down to the target without
 * following symlinks. Any symlink component (or non-regular existing target)
 * could escape or redirect the write and is rejected. Missing components are
 * fine: they are created later as real directories.
 *
 * @param {string} resolvedRoot
 * @param {string} absolutePath
 * @returns {Promise<string | null>} violation message, or null when safe
 */
async function findUnsafePathComponent(resolvedRoot, absolutePath) {
  const segments = path.relative(resolvedRoot, absolutePath).split(path.sep)
  let current = resolvedRoot

  for (let i = 0; i < segments.length; i++) {
    current = path.join(current, segments[i])
    let stats
    try {
      stats = await lstat(current)
    } catch {
      return null
    }
    const componentRel = path.relative(resolvedRoot, current)
    const isTarget = i === segments.length - 1
    if (stats.isSymbolicLink()) {
      return `existing ${isTarget ? 'target' : 'ancestor'} "${componentRel}" is a symlink — remove it so writes cannot be redirected outside ${E2E_OUTPUT_ROOT}/`
    }
    if (isTarget && !stats.isFile()) {
      return `existing target "${componentRel}" is not a regular file`
    }
    if (!isTarget && !stats.isDirectory()) {
      return `existing ancestor "${componentRel}" is not a directory`
    }
  }

  return null
}

/**
 * @param {string} root
 * @param {{ relativePath: string, content: string }[]} outputs
 * @param {{ dryRun?: boolean, force?: boolean }} options
 */
export async function writeOutputs(root, outputs, options = {}) {
  await preflightOutputPaths(root, outputs)

  const written = []
  const skipped = []

  for (const { relativePath, content } of outputs) {
    const absolutePath = path.join(root, relativePath)
    const exists = await fileExists(absolutePath)

    if (exists && !options.force) {
      skipped.push({ relativePath, reason: 'exists (use --force)' })
      continue
    }

    if (options.dryRun) {
      written.push({ relativePath, dryRun: true })
      continue
    }

    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content, 'utf8')
    written.push({ relativePath })
  }

  return { written, skipped }
}

async function fileExists(filePath) {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}
