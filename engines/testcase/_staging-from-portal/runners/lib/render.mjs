import Handlebars from 'handlebars'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const templatesDir = path.join(rootDir, 'templates')

/**
 * @param {string} templateRel
 * @param {Record<string, unknown>} context
 */
export async function renderTemplate(templateRel, context) {
  const templatePath = path.join(templatesDir, templateRel)
  const source = await readFile(templatePath, 'utf8')
  const template = Handlebars.compile(source, { noEscape: true })
  return `${template(context).trim()}\n`
}
