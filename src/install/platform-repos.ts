import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SKILLS_BY_TYPE } from './harness.js'
import type { TestkitType } from '../config/project-root.js'

const NON_PORTABLE = /(\.\.\/|~\/|\/home\/|[A-Za-z]:\\|\\\\)/

export function mergePlatformRepos(opts: {
  projectRoot: string
  type: TestkitType
}): { path: string; warnings: string[] } {
  const root = path.resolve(opts.projectRoot)
  const file = path.join(root, 'platform-repos.json')
  const warnings: string[] = []
  let data: any = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : {
        defaultGroup: opts.type,
        harness: { profiles: {} },
        groups: {
          [opts.type]: {
            description: `${opts.type} current repository`,
            primary: path.basename(root),
            projects: [path.basename(root)],
          },
        },
        projects: {
          [path.basename(root)]: { root: '.', role: opts.type, repo: path.basename(root), write: true },
        },
      }
  if (NON_PORTABLE.test(JSON.stringify(data))) {
    warnings.push('platform-repos.json contains non-portable path patterns')
  }
  data.harness ??= {}
  data.harness.profiles ??= {}
  data.harness.profiles[opts.type] ??= { groups: [opts.type], skills: [] }
  const skills: string[] = data.harness.profiles[opts.type].skills ?? []
  for (const id of SKILLS_BY_TYPE[opts.type]) if (!skills.includes(id)) skills.push(id)
  data.harness.profiles[opts.type].skills = skills
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
  return { path: file, warnings }
}
