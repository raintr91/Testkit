#!/usr/bin/env node
import path from 'node:path'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { loadE2eTestRegistry, REGISTRY_REL, resolveBundleMatchers } from './lib/e2e-registry.mjs'

const root = path.resolve(process.env.TESTKIT_ROOT || process.cwd())

async function pathExists(relativePath) {
  try {
    await access(path.join(root, relativePath))
    return true
  } catch {
    return false
  }
}

async function main() {
  const { registry } = await loadE2eTestRegistry(root)
  const errors = []
  const warnings = []
  const bundles = registry.bundles ?? {}
  const matchers = registry.matchers ?? {}

  console.log(`portal-e2e-test.registry v${registry.version}`)
  console.log(`  path: ${REGISTRY_REL}`)
  console.log(`  bundles: ${Object.keys(bundles).join(', ')}`)

  if (registry.fixture) {
    const exists = await pathExists(registry.fixture)
    if (!exists) errors.push(`fixture: missing ${registry.fixture}`)
  }

  for (const [id, bundle] of Object.entries(bundles)) {
    if (bundle.status === 'planned') {
      warnings.push(`bundle ${id}: planned`)
      continue
    }
    for (const matcher of resolveBundleMatchers(id, bundles)) {
      if (!matchers[matcher]) {
        errors.push(`bundle ${id}: unknown matcher "${matcher}"`)
      }
    }
    for (const parent of bundle.extends ?? []) {
      if (!bundles[parent]) {
        errors.push(`bundle ${id}: extends unknown bundle "${parent}"`)
      }
    }
  }

  for (const [id, meta] of Object.entries(matchers)) {
    if (!meta.layer) {
      warnings.push(`matcher ${id}: missing layer`)
    }
  }

  for (const warning of warnings) {
    console.warn(`  warn: ${warning}`)
  }

  if (errors.length) {
    for (const error of errors) {
      console.error(`  error: ${error}`)
    }
    process.exit(1)
  }

  console.log('portal:e2e-registry OK')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
