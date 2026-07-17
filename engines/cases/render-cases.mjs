#!/usr/bin/env node
/**
 * Render tests hub case YAML → Markdown (member-first, locale-aware).
 * Usage: pnpm cases:render
 *        pnpm cases:render -- cases/W-AD-AUTH-001
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parse, stringify } from 'yaml'

const root = process.cwd()
const casesRoot = path.join(root, 'cases')
const args = process.argv.slice(2).filter((a) => a !== '--')
const only = args[0] ? path.resolve(root, args[0]) : null
const MD_NONE = '_Không có_'

async function loadLocale() {
  const raw = await readFile(path.join(root, 'catalog/locale.yaml'), 'utf8')
  const doc = parse(raw) ?? {}
  const loc = doc.memberLocale || 'vi'
  const headings = doc.headings?.[loc] || doc.headings?.vi || {}
  return { loc, h: headings }
}

async function main() {
  const locale = await loadLocale()
  const files = await listCaseYaml(only ?? casesRoot)
  let n = 0
  for (const file of files) {
    const data = parse(await readFile(file, 'utf8')) ?? {}
    const out = path.join(path.dirname(file), `${path.basename(file).replace(/\.ya?ml$/i, '')}.md`)
    await writeFile(out, renderCaseMarkdown(data, locale), 'utf8')
    n++
    console.log(`cases:render ${path.relative(root, out)}`)
  }
  console.log(`cases:render: OK (${n} file(s))`)
}

function renderCaseMarkdown(tc, { h }) {
  const title = tc.summary || tc.title || tc.id || 'case'
  const story = tc.story?.trim()
  const coverage = Array.isArray(tc.coverage) ? tc.coverage.map((c) => `\`${c}\``).join(', ') : MD_NONE

  const member = [
    `# ${title}`,
    '',
    story || (tc.summary ? `> ${tc.summary}` : null),
    story || tc.summary ? '' : null,
    `- **id:** \`${tc.id ?? ''}\``,
    `- **${h.coverage || 'Coverage'}:** ${coverage}`,
    tc.refs?.scenario ? `- **Scenario:** \`${tc.refs.scenario}\`` : null,
    tc.refs?.rule ? `- **Rule (docs):** \`${tc.refs.rule}\`` : null,
    '',
    `## ${h.preconditions || 'Preconditions'}`,
    '',
    bullets(tc.preconditions),
    '',
    `## ${h.steps || 'Steps'}`,
    '',
    stepsNarrative(tc),
    '',
    `## ${h.expected || 'Expected'}`,
    '',
    bullets(Array.isArray(tc.expected) ? tc.expected : tc.expected ? [tc.expected] : []),
    '',
    '<details>',
    `<summary>${h.technical || 'Technical details'}</summary>`,
    '',
    `- **title (EN):** ${tc.title ?? ''}`,
    tc.refs ? `- **refs:** \`${JSON.stringify(tc.refs)}\`` : null,
    '',
    `### ${h.testData || 'Test data'}`,
    '',
    code(tc.testData ?? tc.data),
    '',
    '### Steps (machine)',
    '',
    stepsMachine(tc.steps),
    '',
    '### Test IDs',
    '',
    bullets(tc.testIds?.required),
    '',
    tc.a11y ? '### a11y\n\n' + code(tc.a11y) : null,
    '',
    '</details>',
    '',
  ]

  return member.filter((x) => x !== null).join('\n')
}

function stepsNarrative(tc) {
  const steps = tc.steps || []
  if (!steps.length) return MD_NONE
  return steps
    .map((step, i) => {
      if (step.as || step.label) return `${i + 1}. ${step.as || step.label}`
      if (step.action === 'goto') return `${i + 1}. Mở trang \`${step.path ?? ''}\``
      if (step.action === 'fill') return `${i + 1}. Nhập vào \`${step.testId ?? 'field'}\``
      if (step.action === 'click') return `${i + 1}. Bấm \`${step.testId ?? 'control'}\``
      return `${i + 1}. ${step.action ?? 'step'}`
    })
    .join('\n')
}

function stepsMachine(items = []) {
  if (!items?.length) return MD_NONE
  return items
    .map((step, i) => {
      const parts = Object.entries(step)
        .map(([k, v]) => `${k}: ${inline(v)}`)
        .join(', ')
      return `${i + 1}. ${parts}`
    })
    .join('\n')
}

function bullets(items = []) {
  return items?.length ? items.map((i) => `- ${inline(i)}`).join('\n') : MD_NONE
}

function code(value) {
  return `\`\`\`yaml\n${stringify(value ?? {}).trim()}\n\`\`\``
}

function inline(value) {
  if (typeof value === 'string') return value
  return `\`${JSON.stringify(value)}\``
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
