import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { WacrmClient } from '../client.js';
import { handle, jsonResult } from './shared.js';

export function registerWriteTools(server: McpServer, client: WacrmClient): void {
  server.registerTool(
    'create_contact',
    {
      title: 'Create contact',
      description: 'Create a XerMedia contact. This never sends a WhatsApp message.',
      inputSchema: {
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    handle(async (args) => jsonResult((await client.createContact(args)).data)),
  );

  server.registerTool(
    'update_contact',
    {
      title: 'Update contact',
      description: 'Update a XerMedia contact. This never sends a WhatsApp message.',
      inputSchema: {
        id: z.string(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    handle(async ({ id, ...patch }) =>
      jsonResult((await client.updateContact(id, patch)).data),
    ),
  );
}
