import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * @param {string} root
 * @param {{ relativePath: string, content: string }[]} outputs
 * @param {{ dryRun?: boolean, force?: boolean }} options
 */
export async function writeOutputs(root, outputs, options = {}) {
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
