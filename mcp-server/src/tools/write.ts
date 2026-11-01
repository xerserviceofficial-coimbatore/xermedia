import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { WacrmClient } from '../client.js';
import { asText, registerTool } from './shared.js';

export function registerWriteTools(server: McpServer, client: WacrmClient): void {
  registerTool(
    server,
    'create_contact',
    'Create a contact in XerMedia. This does not send a WhatsApp message.',
    {
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => asText((await client.createContact(args)).data),
  );

  registerTool(
    server,
    'update_contact',
    'Update an existing XerMedia contact. This does not send a WhatsApp message.',
    {
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ id, ...patch }) => asText((await client.updateContact(id, patch)).data),
  );
}
