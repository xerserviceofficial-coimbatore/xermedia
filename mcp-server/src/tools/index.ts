import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { WacrmClient } from '../client.js';
import type { Config } from '../config.js';
import { registerReadTools } from './read.js';
import { registerWriteTools } from './write.js';

export function registerAllTools(
  server: McpServer,
  client: WacrmClient,
  config: Config,
): void {
  registerReadTools(server, client);
  if (config.enableWrites) registerWriteTools(server, client);
}
