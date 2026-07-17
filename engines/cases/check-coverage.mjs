#!/usr/bin/env node
/**
 * Compare SC coverage_plan ↔ TC coverage (same scenario).
 * Usage: pnpm check:coverage
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'

const root = process.cwd()

async function main() {
  const scenarios = await listFiles(path.join(root, 'scenarios'), /^SC-.*\.md$/i)
  const cases = await listFiles(path.join(root, 'cases'), /^TC-.*\.ya?ml$/i)
  const byScenario = new Map()

  for (const file of cases) {
    const tc = parse(await readFile(file, 'utf8')) ?? {}
    const sc = tc.refs?.scenario
    if (!sc) continue
    if (!byScenario.has(sc)) byScenario.set(sc, [])
    byScenario.get(sc).push({
      id: tc.id,
      coverage: new Set(tc.coverage ?? []),
      file: path.relative(root, file),
    })
  }

  const gaps = []
  const notes = []

  for (const file of scenarios) {
    const raw = await readFile(file, 'utf8')
    const fm = parseFrontmatter(raw)
    const scId = fm.id || path.basename(file, '.md')
    const plan = Array.isArray(fm.coverage_plan) ? fm.coverage_plan : []
    if (!plan.length) {
      notes.push(`${path.relative(root, file)}: no coverage_plan in frontmatter`)
      continue
    }
    const tcs = byScenario.get(scId) || []
    const covered = new Set()
    for (const tc of tcs) for (const c of tc.coverage) covered.add(c)

    for (const facet of plan) {
      if (!covered.has(facet)) {
        gaps.push(`${scId}: coverage_plan "${facet}" — chưa có TC (files: ${tcs.map((t) => t.id).join(', ') || 'none'})`)
      }
    }
    for (const tc of tcs) {
      for (const c of tc.coverage) {
        if (!plan.includes(c)) {
          notes.push(`${tc.id}: coverage "${c}" không nằm trong ${scId} coverage_plan`)
        }
      }
    }
  }

  for (const n of notes) console.warn(`  note: ${n}`)
  if (gaps.length) {
    console.error('check:coverage FAILED — thiếu bao phủ:')
    for (const g of gaps) console.error(`  - ${g}`)
    process.exit(1)
  }
  console.log(`check:coverage OK (${scenarios.length} SC, ${cases.length} TC)`)
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return {}
  const end = raw.indexOf('\n---', 3)
  if (end < 0) return {}
  try {
    return parse(raw.slice(3, end)) ?? {}
  } catch {
    return {}
  }
}

async function listFiles(dir, re) {
  const out = []
  for (const entry of await listEntries(dir)) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listFiles(p, re)))
      continue
    }
    if (entry.isFile() && re.test(entry.name)) out.push(p)
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
