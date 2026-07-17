import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'

export function createServer(): McpServer {
  const server = new McpServer({ name: 'testkit', version: '0.2.3' })
  registerTools(server)
  return server
}

export async function main(): Promise<void> {
  await createServer().connect(new StdioServerTransport())
}

const entry = process.argv[1] ?? ''
if (entry.includes('mcp/server') || entry.includes('testkit-mcp')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
