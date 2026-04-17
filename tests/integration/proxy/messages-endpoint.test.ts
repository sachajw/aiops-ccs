import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import getPort from 'get-port';
import * as http from 'http';
import { startOpenAICompatProxyServer } from '../../../src/proxy/server/proxy-server';
import type { OpenAICompatProfileConfig } from '../../../src/proxy/profile-router';

let upstreamServer: http.Server;
let proxyServer: http.Server;
let upstreamBody: unknown;
let upstreamPort: number;
let proxyPort: number;

function startMockUpstream(): Promise<void> {
  return new Promise((resolve) => {
    upstreamServer = http.createServer(async (req, res) => {
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      upstreamBody = JSON.parse(body);
      const parsed = upstreamBody as { stream?: boolean };

      if (parsed.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(
          'data: {"id":"chatcmpl_1","model":"hf-model","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}\n\n'
        );
        res.write(
          'data: {"id":"chatcmpl_1","model":"hf-model","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"search","arguments":"{\\"q\\":\\"docs\\"}"}}]}}]}\n\n'
        );
        res.write(
          'data: {"id":"chatcmpl_1","model":"hf-model","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":9,"completion_tokens":4}}\n\n'
        );
        res.end('data: [DONE]\n\n');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl_1',
          model: 'hf-model',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Plain answer' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 3 },
        })
      );
    });

    upstreamServer.listen(upstreamPort, '127.0.0.1', () => resolve());
  });
}

async function requestProxy(payload: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': 'test-proxy-token',
    },
    body: JSON.stringify(payload),
  });
}

beforeEach(async () => {
  upstreamPort = await getPort();
  proxyPort = await getPort();
  upstreamBody = undefined;
  await startMockUpstream();
  const profile: OpenAICompatProfileConfig = {
    profileName: 'hf',
    settingsPath: '/tmp/hf.settings.json',
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: 'hf_token',
    provider: 'generic-chat-completion-api',
    model: 'hf-model',
  };
  proxyServer = startOpenAICompatProxyServer({
    profile,
    port: proxyPort,
    authToken: 'test-proxy-token',
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
  await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
});

describe('openai proxy messages endpoint', () => {
  it('translates Anthropic requests to OpenAI upstream and streams Anthropic SSE back', async () => {
    const response = await requestProxy({
      model: 'hf-model',
      stream: true,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Find docs' }] }],
      tools: [{ name: 'search', description: 'Search docs', input_schema: { type: 'object' } }],
    });

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('event: message_start');
    expect(body).toContain('content_block_delta');
    expect(body).toContain('tool_use');
    expect(body).toContain('message_stop');

    const parsedUpstream = upstreamBody as {
      messages?: Array<{ role: string; content: string }>;
      tools?: Array<{ type: string; function: { name: string } }>;
    };
    expect(parsedUpstream.messages?.[0]).toEqual({ role: 'user', content: 'Find docs' });
    expect(parsedUpstream.tools?.[0]?.type).toBe('function');
    expect(parsedUpstream.tools?.[0]?.function.name).toBe('search');
  });

  it('falls back to Anthropic JSON for non-streaming requests', async () => {
    const response = await requestProxy({
      model: 'hf-model',
      messages: [{ role: 'user', content: 'hello' }],
    });
    const body = (await response.json()) as {
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.type).toBe('message');
    expect(body.content?.[0]).toEqual({ type: 'text', text: 'Plain answer' });
  });

  it('returns invalid_request_error for malformed JSON', async () => {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'test-proxy-token',
      },
      body: '{bad-json',
    });
    const body = (await response.json()) as { error?: { type?: string; message?: string } };

    expect(response.status).toBe(400);
    expect(body.error?.type).toBe('invalid_request_error');
    expect(body.error?.message).toContain('Invalid JSON');
  });

  it('rejects requests without the local proxy auth token', async () => {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'hf-model',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    const body = (await response.json()) as { error?: { type?: string } };

    expect(response.status).toBe(401);
    expect(body.error?.type).toBe('authentication_error');
  });

  it('translates supported Anthropic image blocks into OpenAI image_url content', async () => {
    const response = await requestProxy({
      model: 'hf-model',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'ZmFrZQ==',
              },
            },
          ],
        },
      ],
    });

    expect(response.status).toBe(200);
    const parsedUpstream = upstreamBody as {
      messages?: Array<{
        role: string;
        content: Array<{ type: string; text?: string; image_url?: { url?: string } }>;
      }>;
    };
    expect(parsedUpstream.messages?.[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,ZmFrZQ==' },
        },
      ],
    });
  });

  it('accepts query strings and trailing slashes on the messages route', async () => {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages/?beta=test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        authorization: 'Bearer test-proxy-token',
      },
      body: JSON.stringify({
        model: 'hf-model',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(response.status).toBe(200);
  });
});
