// ============================================================
// MCP configuration.
//
// XerMedia is receive-only. The optional write flag only enables contact
// create/update tools; it never enables WhatsApp sending.
// ============================================================

export interface Config {
  baseUrl: string;
  apiKey: string;
  enableWrites: boolean;
}

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? '');
}

export function loadConfig(): Config {
  const baseUrl = (process.env.WACRM_BASE_URL ?? '').trim().replace(/\/$/, '');
  const apiKey = (process.env.WACRM_API_KEY ?? '').trim();

  if (!baseUrl) {
    throw new Error('WACRM_BASE_URL is required.');
  }
  if (!apiKey) {
    throw new Error('WACRM_API_KEY is required.');
  }

  return {
    baseUrl,
    apiKey,
    enableWrites: truthy(process.env.WACRM_ENABLE_WRITES),
  };
}
