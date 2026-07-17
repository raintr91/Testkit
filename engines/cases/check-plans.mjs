#!/usr/bin/env node
/**
 * Validate TC-*.yaml against schemas/testcase.schema.json (package SSOT).
 * Usage: pnpm check:plans  |  testkit cases:check
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { parse } from 'yaml'

const root = process.cwd()
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function resolveSchemaPath() {
  if (process.env.TESTKIT_TESTCASE_SCHEMA) {
    return path.resolve(process.env.TESTKIT_TESTCASE_SCHEMA)
  }
  return path.join(packageRoot, 'schemas', 'testcase.schema.json')
}

async function main() {
  const schemaPath = resolveSchemaPath()
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  const validate = new Ajv2020({ allErrors: true }).compile(schema)
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
    if (!validate(data)) {
      errors.push(...(validate.errors ?? []).map((error) => formatValidationError(rel, error)))
    }
  }
  if (errors.length) {
    console.error('check:plans FAILED')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`check:plans OK (${files.length} case(s))`)
}

function formatValidationError(rel, error) {
  const location = error.instancePath
    .split('/')
    .filter(Boolean)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .join('.')
  if (error.keyword === 'required') {
    const field = [location, error.params.missingProperty].filter(Boolean).join('.')
    return `${rel}: ${field} required`
  }
  return `${rel}${location ? `: ${location}` : ''}: ${error.message}`
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
  console.error('check:plans FAILED')
  console.error(`  - ${e.message}`)
  process.exit(1)
})
