#!/usr/bin/env node
/**
 * Validate TC-*.yaml against schemas/testcase.schema.json (lightweight, no ajv).
 * Usage: pnpm check:plans
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'

const root = process.cwd()
const COVERAGE = new Set([
  'happy',
  'validation',
  'boundary',
  'authorization',
  'state',
  'exception',
  'concurrency',
  'audit',
  'accessibility',
])

async function main() {
  const files = await listCaseYaml(path.join(root, 'cases'))
  const errors = []
  for (const file of files) {
    const rel = path.relative(root, file)
    let data
    try {
      data = parse(await readFile(file, 'utf8'))
    } catch (e) {
      errors.push(`${rel}: YAML parse — ${e.message}`)
      continue
    }
    errors.push(...validateCase(data, rel))
  }
  if (errors.length) {
    console.error('check:plans FAILED')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`check:plans OK (${files.length} case(s))`)
}

function validateCase(tc, rel) {
  const err = []
  if (!tc?.id || !/^TC-[A-Z0-9-]+$/.test(tc.id)) err.push(`${rel}: id must match TC-*`)
  if (!tc?.title) err.push(`${rel}: title required`)
  if ('type' in (tc || {})) err.push(`${rel}: type is removed — use coverage[]`)
  if (!Array.isArray(tc?.coverage) || !tc.coverage.length) {
    err.push(`${rel}: coverage[] required`)
  } else {
    for (const c of tc.coverage) {
      if (!COVERAGE.has(c)) err.push(`${rel}: unknown coverage "${c}"`)
    }
  }
  const refs = tc?.refs || {}
  for (const k of ['screen', 'scenario', 'target']) {
    if (!refs[k]) err.push(`${rel}: refs.${k} required`)
  }
  if (!refs.capability) err.push(`${rel}: refs.capability required`)
  if (!refs.component && !refs.feature) err.push(`${rel}: refs.component or refs.feature required`)
  if (tc?.genType !== 'e2e') err.push(`${rel}: genType must be e2e`)
  if (!tc?.feature) err.push(`${rel}: feature (bridge slug) required`)
  if (!tc?.route?.path) err.push(`${rel}: route.path required`)
  if (!tc?.testIds || typeof tc.testIds !== 'object') err.push(`${rel}: testIds required`)
  if (tc.coverage?.includes('accessibility') && !tc.a11y) {
    err.push(`${rel}: coverage accessibility requires a11y: block`)
  }
  return err
}

async function listCaseYaml(dir) {
  const out = []
  for (const entry of await listEntries(dir)) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listCaseYaml(p)))
      continue
    }
    if (entry.isFile() && /^TC-.*\.ya?ml$/i.test(entry.name)) out.push(p)
  }
  return out.sort()
}

async function listEntries(dir) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
