const MCP_URL = 'https://anvil.servicetitan.com/mcp';

async function parseSSEResponse(res: globalThis.Response): Promise<unknown> {
  const text = await res.text();
  const dataLines = text.split('\n').filter((l) => l.startsWith('data: '));
  const lastData = dataLines[dataLines.length - 1]?.slice(6);
  return lastData ? JSON.parse(lastData) : null;
}

/**
 * Query the Anvil2 MCP server for component documentation.
 * Stateless — each call initializes and queries in two requests.
 */
export async function searchAnvil(query: string): Promise<string> {
  // Initialize MCP session (required by protocol, even though server is stateless)
  await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'booking-agent', version: '1.0' },
      },
      id: 1,
    }),
  });

  // Call search_anvil2
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'search_anvil2', arguments: { query } },
      id: 2,
    }),
  });

  const data = (await parseSSEResponse(res)) as {
    result?: { content?: Array<{ text: string }> };
    error?: { message: string };
  };

  if (data?.error) {
    return `Anvil MCP error: ${data.error.message}`;
  }

  return data?.result?.content?.[0]?.text ?? 'No documentation found.';
}
