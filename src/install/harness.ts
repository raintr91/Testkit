import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { packageRoot, packageVersion, type TestkitType } from '../config/project-root.js'

export const SKILLS_BY_TYPE: Record<TestkitType, string[]> = {
  tests: ['testcase', 'grill-testcase'],
  fe: ['test', 'grill-test'],
}

export interface InstallManifestFile {
  source: string
  sha256: string
  stale?: boolean
}

export interface InstallManifest {
  schemaVersion: 1
  package: '@platform/testkit'
  packageVersion: string
  type: TestkitType
  toolApi: 1
  harnessApi: 1
  files: Record<string, InstallManifestFile>
}

export interface HarnessCompatibility {
  compatible: boolean
  issues: string[]
}

export interface HarnessStatus {
  manifestPath: string
  installed: boolean
  type?: TestkitType
  packageVersion?: string
  compatibility: HarnessCompatibility
  healthy: string[]
  missing: string[]
  modified: string[]
  stale: string[]
}

export interface PruneHarnessResult {
  dryRun: boolean
  candidates: string[]
  deleted: string[]
  preservedModified: string[]
  missing: string[]
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function walk(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const name of readdirSync(root)) {
    const file = path.join(root, name)
    if (statSync(file).isDirectory()) out.push(...walk(file))
    else out.push(file)
  }
  return out
}

function manifestFile(root: string): string {
  return path.join(root, '.testkit', 'install-manifest.json')
}

function loadManifest(root: string): InstallManifest | null {
  const file = manifestFile(root)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as InstallManifest) : null
}

function currentFiles(type: TestkitType): InstallManifest['files'] {
  const sourceRoot = path.join(packageRoot(), 'harness', type)
  const files: InstallManifest['files'] = {}
  for (const source of walk(sourceRoot)) {
    const rel = path.relative(sourceRoot, source)
    const targetRel = path.join('.cursor', rel).split(path.sep).join('/')
    const content = readFileSync(source, 'utf8')
    files[targetRel] = {
      source: path.relative(packageRoot(), source).split(path.sep).join('/'),
      sha256: hash(content),
    }
  }
  return files
}

function managedTarget(root: string, targetRel: string): string | null {
  const target = path.resolve(root, targetRel)
  const relative = path.relative(root, target)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
    ? target
    : null
}

function targetHash(target: string): string | null {
  try {
    if (!statSync(target).isFile()) return null
    return hash(readFileSync(target, 'utf8'))
  } catch {
    return null
  }
}

function compatibility(manifest: InstallManifest): HarnessCompatibility {
  const issues: string[] = []
  if (manifest.schemaVersion !== 1) issues.push(`unsupported schemaVersion: ${String(manifest.schemaVersion)}`)
  if (manifest.package !== '@platform/testkit') issues.push(`unexpected package: ${String(manifest.package)}`)
  if (manifest.toolApi !== 1) issues.push(`unsupported toolApi: ${String(manifest.toolApi)}`)
  if (manifest.harnessApi !== 1) issues.push(`unsupported harnessApi: ${String(manifest.harnessApi)}`)
  if (!['tests', 'fe'].includes(manifest.type)) issues.push(`unsupported type: ${String(manifest.type)}`)
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
    issues.push('invalid files inventory')
  }
  for (const [targetRel, metadata] of Object.entries(manifest.files ?? {})) {
    if (!managedTarget('/testkit-project', targetRel)) issues.push(`unsafe managed target: ${targetRel}`)
    if (
      !metadata
      || typeof metadata.source !== 'string'
      || typeof metadata.sha256 !== 'string'
      || (metadata.stale !== undefined && typeof metadata.stale !== 'boolean')
    ) {
      issues.push(`invalid file metadata: ${targetRel}`)
    }
  }
  return { compatible: issues.length === 0, issues }
}

export function installHarness(opts: {
  projectRoot: string
  type: TestkitType
  force?: boolean
}): { written: string[]; unchanged: string[]; conflicts: string[] } {
  const root = path.resolve(opts.projectRoot)
  const previous = loadManifest(root)
  if (previous) {
    const check = compatibility(previous)
    if (!check.compatible) throw new Error(`Incompatible Testkit install manifest: ${check.issues.join('; ')}`)
  }
  const result = { written: [] as string[], unchanged: [] as string[], conflicts: [] as string[] }
  const files = currentFiles(opts.type)
  for (const [targetRel, metadata] of Object.entries(files)) {
    const source = path.join(packageRoot(), metadata.source)
    const target = path.join(root, targetRel)
    const content = readFileSync(source, 'utf8')
    if (existsSync(target)) {
      const current = readFileSync(target, 'utf8')
      if (current === content) {
        result.unchanged.push(target)
        continue
      }
      const safe = previous?.files[targetRel]?.sha256 === hash(current)
      if (!opts.force && !safe) {
        result.conflicts.push(target)
        continue
      }
    }
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
    result.written.push(target)
  }
  for (const [targetRel, metadata] of Object.entries(previous?.files ?? {})) {
    if (!files[targetRel]) files[targetRel] = { ...metadata, stale: true }
  }
  mkdirSync(path.dirname(manifestFile(root)), { recursive: true })
  writeFileSync(
    manifestFile(root),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        package: '@platform/testkit',
        packageVersion: packageVersion(),
        type: opts.type,
        toolApi: 1,
        harnessApi: 1,
        files,
      } satisfies InstallManifest,
      null,
      2,
    )}\n`,
  )
  return result
}

export function statusHarness(opts: { projectRoot: string }): HarnessStatus {
  const root = path.resolve(opts.projectRoot)
  const manifestPath = manifestFile(root)
  const manifest = loadManifest(root)
  const result: HarnessStatus = {
    manifestPath,
    installed: manifest !== null,
    compatibility: manifest
      ? compatibility(manifest)
      : { compatible: false, issues: ['install manifest not found'] },
    healthy: [],
    missing: [],
    modified: [],
    stale: [],
  }
  if (!manifest) return result
  result.type = manifest.type
  result.packageVersion = manifest.packageVersion
  const currentTargets = ['tests', 'fe'].includes(manifest.type)
    ? new Set(Object.keys(currentFiles(manifest.type)))
    : new Set<string>()
  for (const [targetRel, metadata] of Object.entries(manifest.files ?? {})) {
    const target = managedTarget(root, targetRel)
    if (!currentTargets.has(targetRel)) {
      result.stale.push(targetRel)
    } else if (!target || !existsSync(target)) {
      result.missing.push(targetRel)
    } else if (targetHash(target) !== metadata.sha256) {
      result.modified.push(targetRel)
    } else {
      result.healthy.push(targetRel)
    }
  }
  return result
}

export function pruneHarness(opts: { projectRoot: string; yes?: boolean }): PruneHarnessResult {
  const root = path.resolve(opts.projectRoot)
  const manifest = loadManifest(root)
  if (!manifest) throw new Error(`Testkit install manifest not found: ${manifestFile(root)}`)
  const check = compatibility(manifest)
  if (!check.compatible) throw new Error(`Incompatible Testkit install manifest: ${check.issues.join('; ')}`)
  const currentTargets = new Set(Object.keys(currentFiles(manifest.type)))
  const result: PruneHarnessResult = {
    dryRun: !opts.yes,
    candidates: [],
    deleted: [],
    preservedModified: [],
    missing: [],
  }
  for (const [targetRel, metadata] of Object.entries(manifest.files)) {
    if (currentTargets.has(targetRel)) continue
    const target = managedTarget(root, targetRel)
    if (!target || !existsSync(target)) {
      result.missing.push(targetRel)
      continue
    }
    if (targetHash(target) !== metadata.sha256) {
      result.preservedModified.push(targetRel)
      continue
    }
    result.candidates.push(targetRel)
    if (opts.yes) {
      rmSync(target)
      delete manifest.files[targetRel]
      result.deleted.push(targetRel)
    }
  }
  if (opts.yes && result.deleted.length > 0) {
    writeFileSync(manifestFile(root), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return result
}
