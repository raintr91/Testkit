import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { packageRoot } from '../config/project-root.js'
import type { TestkitType } from '../config/project-root.js'

export function installCursorMcp(opts: {
  projectRoot: string
  type: TestkitType
  testsRoot?: string
  docsRoot?: string
}): { path: string; written: boolean } {
  const root = path.resolve(opts.projectRoot)
  const file = path.join(root, '.cursor', 'mcp.json')
  mkdirSync(path.dirname(file), { recursive: true })
  let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} }
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, 'utf8')) as typeof config
    } catch {
      config = { mcpServers: {} }
    }
  }
  if (!config.mcpServers) config.mcpServers = {}
  const env: Record<string, string> = {
    TESTKIT_ROOT: root,
    TESTKIT_TYPE: opts.type,
  }
  if (opts.testsRoot) env.TESTKIT_TESTS_ROOT = path.resolve(opts.testsRoot)
  if (opts.docsRoot) env.TESTKIT_DOCS_ROOT = path.resolve(opts.docsRoot)
  const entry = {
    type: 'stdio',
    command: process.execPath,
    args: [path.join(packageRoot(), 'bin', 'testkit-mcp.mjs')],
    env,
  }
  if (JSON.stringify(config.mcpServers.testkit) === JSON.stringify(entry)) {
    return { path: file, written: false }
  }
  config.mcpServers.testkit = entry
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
  return { path: file, written: true }
}

export type McpLocation = 'local' | 'global'

export interface UninstallCursorMcpResult {
  path: string
  dryRun: boolean
  removed: boolean
  absent: boolean
  preservedInvalid: boolean
}

export function cursorMcpPath(opts: {
  location: McpLocation
  projectRoot?: string
}): string {
  if (opts.location === 'global') {
    return process.env.TESTKIT_GLOBAL_MCP_FILE
      ? path.resolve(process.env.TESTKIT_GLOBAL_MCP_FILE)
      : path.join(os.homedir(), '.cursor', 'mcp.json')
  }
  return path.join(path.resolve(opts.projectRoot ?? process.cwd()), '.cursor', 'mcp.json')
}

/** Remove only the Testkit key, preserving every other MCP server and setting. */
export function uninstallCursorMcp(opts: {
  location: McpLocation
  projectRoot?: string
  yes?: boolean
}): UninstallCursorMcpResult {
  const file = cursorMcpPath(opts)
  const result: UninstallCursorMcpResult = {
    path: file,
    dryRun: !opts.yes,
    removed: false,
    absent: false,
    preservedInvalid: false,
  }
  if (!existsSync(file)) {
    result.absent = true
    return result
  }
  let config: { mcpServers?: Record<string, unknown> }
  try {
    config = JSON.parse(readFileSync(file, 'utf8')) as typeof config
  } catch {
    result.preservedInvalid = true
    return result
  }
  if (!config.mcpServers || !('testkit' in config.mcpServers)) {
    result.absent = true
    return result
  }
  result.removed = true
  if (opts.yes) {
    delete config.mcpServers.testkit
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  }
  return result
}
