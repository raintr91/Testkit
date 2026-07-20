import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const REGISTRY_REL = 'registries/e2e-test.registry.json'

/**
 * @param {string} root
 */
export async function loadE2eTestRegistry(root) {
  const registryPath = path.join(root, REGISTRY_REL)
  const raw = await readFile(registryPath, 'utf8')
  const registry = JSON.parse(raw)
  return { registry, registryPath }
}

/**
 * @param {string} tag
 * @param {{ tagPrefixes: { e2eBundle: string, skipAssert: string } }} registry
 */
export function parseE2eBundleTag(tag, registry) {
  const prefix = registry.tagPrefixes?.e2eBundle ?? '#e2e:'
  const trimmed = String(tag).trim()
  if (!trimmed.startsWith(prefix)) return null
  return trimmed.slice(prefix.length)
}

/**
 * @param {string} tag
 * @param {{ tagPrefixes: { skipAssert: string } }} registry
 */
export function parseSkipAssertTag(tag, registry) {
  const prefix = registry.tagPrefixes?.skipAssert ?? '#skip-e2e-assert:'
  const trimmed = String(tag).trim()
  if (!trimmed.startsWith(prefix)) return null
  return trimmed.slice(prefix.length)
}

/**
 * @param {string} bundleId
 * @param {Record<string, { extends?: string[], matchers?: string[] }>} bundles
 * @param {Set<string>} visited
 * @returns {string[]}
 */
export function resolveBundleMatchers(bundleId, bundles, visited = new Set()) {
  if (visited.has(bundleId)) return []
  visited.add(bundleId)

  const bundle = bundles[bundleId]
  if (!bundle) return []

  const fromExtends = (bundle.extends ?? []).flatMap((id) => resolveBundleMatchers(id, bundles, visited))
  const own = bundle.matchers ?? []
  return [...fromExtends, ...own]
}

/**
 * @param {string[]} tags
 * @param {Record<string, unknown>} registry
 */
export function bundleIdsFromTags(tags, registry) {
  const bundles = registry.bundles ?? {}
  return tags
    .map((tag) => parseE2eBundleTag(tag, registry))
    .filter((id) => id && bundles[id])
}

/**
 * @param {string[]} tags
 * @param {Record<string, unknown>} registry
 */
export function skipMatchersFromTags(tags, registry) {
  return new Set(
    tags
      .map((tag) => parseSkipAssertTag(tag, registry))
      .filter(Boolean)
  )
}
