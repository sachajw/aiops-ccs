interface AnthropicThinking {
  type?: 'enabled' | 'disabled' | string;
  budget_tokens?: number;
}

interface AnthropicTextBlock {
  type: 'text';
  text?: string;
}

interface AnthropicImageBlock {
  type: 'image';
  source?: {
    type?: string;
    media_type?: string;
    data?: string;
  };
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id?: string;
  content?: unknown;
}

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock
  | { type: string; [key: string]: unknown };

interface AnthropicMessage {
  role?: 'user' | 'assistant' | string;
  content?: string | AnthropicContentBlock[];
}

interface AnthropicProxyRequestShape {
  model?: unknown;
  system?: unknown;
  messages?: unknown;
  max_tokens?: unknown;
  temperature?: unknown;
  top_p?: unknown;
  stop_sequences?: unknown;
  metadata?: unknown;
  tools?: unknown;
  stream?: unknown;
  thinking?: AnthropicThinking;
}

interface OpenAITextPart {
  type: 'text';
  text: string;
}

interface OpenAIImagePart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

type OpenAIContentPart = OpenAITextPart | OpenAIImagePart;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ProxyOpenAIRequest {
  model?: string;
  stream: boolean;
  reasoning_effort?: string;
  reasoning?: {
    enabled: boolean;
    effort: string;
  };
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  metadata?: Record<string, unknown>;
}

const TOOL_RESULT_SERIALIZATION_FALLBACK = '[unserializable content]';
const TOOL_USE_ARGUMENTS_FALLBACK = '{}';

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const result = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0
  );
  return result.length > 0 ? result : undefined;
}

function asMetadata(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeJsonStringify(value: unknown, fallback: string): string {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : fallback;
  } catch {
    return fallback;
  }
}

function flattenTextContent(content: unknown, label: string): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    throw new Error(`${label} must be a string or content block array`);
  }

  return content
    .map((block, index) => {
      const parsed = assertObject(block, `${label}[${index}]`);
      if (parsed.type !== 'text') {
        throw new Error(`${label}[${index}].type "${String(parsed.type)}" is not supported`);
      }
      return typeof parsed.text === 'string' ? parsed.text : '';
    })
    .join('\n');
}

function toToolResultContent(content: unknown, label: string): string {
  if (content === undefined) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return flattenTextContent(content, label);
  }
  return safeJsonStringify(content, TOOL_RESULT_SERIALIZATION_FALLBACK);
}

function createFallbackToolId(messageIndex: number, blockIndex: number): string {
  return `toolu_proxy_fallback_${messageIndex}_${blockIndex}`;
}

function toImagePart(block: AnthropicImageBlock, label: string): OpenAIImagePart {
  const source = block.source;
  if (!source || source.type !== 'base64' || !source.media_type || !source.data) {
    throw new Error(`${label}.source must be a base64 image payload`);
  }

  return {
    type: 'image_url',
    image_url: {
      url: `data:${source.media_type};base64,${source.data}`,
    },
  };
}

function isImageBlock(block: AnthropicContentBlock): block is AnthropicImageBlock {
  return block.type === 'image';
}

function isToolUseBlock(block: AnthropicContentBlock): block is AnthropicToolUseBlock {
  return block.type === 'tool_use';
}

function isToolResultBlock(block: AnthropicContentBlock): block is AnthropicToolResultBlock {
  return block.type === 'tool_result';
}

function flushUserContent(messages: OpenAIMessage[], parts: OpenAIContentPart[]): void {
  if (parts.length === 0) {
    return;
  }

  const onlyText = parts.every((part) => part.type === 'text');
  messages.push({
    role: 'user',
    content: onlyText ? parts.map((part) => (part as OpenAITextPart).text).join('\n') : [...parts],
  });
  parts.length = 0;
}

function transformTools(value: unknown): ProxyOpenAIRequest['tools'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tools = value
    .filter(
      (entry): entry is { name?: unknown; description?: unknown; input_schema?: unknown } =>
        typeof entry === 'object' && entry !== null
    )
    .map((entry) => ({
      type: 'function' as const,
      function: {
        name: typeof entry.name === 'string' ? entry.name : 'tool',
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
        parameters:
          typeof entry.input_schema === 'object' && entry.input_schema !== null
            ? (entry.input_schema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      },
    }));

  return tools.length > 0 ? tools : undefined;
}

function mapThinkingToReasoning(
  thinking: AnthropicThinking | undefined
): Pick<ProxyOpenAIRequest, 'reasoning' | 'reasoning_effort'> {
  if (!thinking || thinking.type === 'disabled') {
    return {};
  }

  if (thinking.type !== 'enabled') {
    throw new Error('thinking.type must be "enabled" or "disabled"');
  }

  const effort =
    typeof thinking.budget_tokens === 'number' && thinking.budget_tokens >= 8192
      ? 'high'
      : 'medium';

  return {
    reasoning_effort: effort,
    reasoning: {
      enabled: true,
      effort,
    },
  };
}

function transformMessages(messagesValue: unknown): OpenAIMessage[] {
  if (!Array.isArray(messagesValue)) {
    throw new Error('messages must be an array');
  }

  const translatedMessages: OpenAIMessage[] = [];

  messagesValue.forEach((message, messageIndex) => {
    const parsedMessage = assertObject(message, `messages[${messageIndex}]`) as AnthropicMessage;
    const role = parsedMessage.role;
    if (role !== 'user' && role !== 'assistant') {
      throw new Error(`messages[${messageIndex}].role must be "user" or "assistant"`);
    }

    const content = parsedMessage.content;
    if (typeof content === 'string') {
      translatedMessages.push({ role, content });
      return;
    }

    if (!Array.isArray(content)) {
      throw new Error(`messages[${messageIndex}].content must be a string or array`);
    }

    const userParts: OpenAIContentPart[] = [];
    const assistantTextParts: string[] = [];
    const toolCalls: NonNullable<OpenAIMessage['tool_calls']> = [];
    let sawToolResult = false;

    content.forEach((block, blockIndex) => {
      const parsed = assertObject(
        block,
        `messages[${messageIndex}].content[${blockIndex}]`
      ) as AnthropicContentBlock;

      if (parsed.type === 'text') {
        const text = typeof parsed.text === 'string' ? parsed.text : '';
        if (role === 'user') {
          userParts.push({ type: 'text', text });
        } else {
          assistantTextParts.push(text);
        }
        return;
      }

      if (isImageBlock(parsed)) {
        if (role !== 'user') {
          throw new Error(
            `messages[${messageIndex}].content[${blockIndex}] image requires user role`
          );
        }
        userParts.push(toImagePart(parsed, `messages[${messageIndex}].content[${blockIndex}]`));
        return;
      }

      if (isToolUseBlock(parsed)) {
        if (role !== 'assistant') {
          throw new Error(
            `messages[${messageIndex}].content[${blockIndex}] tool_use requires assistant role`
          );
        }
        toolCalls.push({
          id:
            typeof parsed.id === 'string' && parsed.id.length > 0
              ? parsed.id
              : createFallbackToolId(messageIndex, blockIndex),
          type: 'function',
          function: {
            name: typeof parsed.name === 'string' ? parsed.name : 'tool',
            arguments: safeJsonStringify(parsed.input ?? {}, TOOL_USE_ARGUMENTS_FALLBACK),
          },
        });
        return;
      }

      if (isToolResultBlock(parsed)) {
        if (role !== 'user') {
          throw new Error(
            `messages[${messageIndex}].content[${blockIndex}] tool_result requires user role`
          );
        }
        if (typeof parsed.tool_use_id !== 'string' || parsed.tool_use_id.trim().length === 0) {
          throw new Error(
            `messages[${messageIndex}].content[${blockIndex}].tool_use_id must be a non-empty string`
          );
        }
        sawToolResult = true;
        flushUserContent(translatedMessages, userParts);
        translatedMessages.push({
          role: 'tool',
          tool_call_id: parsed.tool_use_id,
          content: toToolResultContent(
            parsed.content,
            `messages[${messageIndex}].content[${blockIndex}].content`
          ),
        });
        return;
      }

      throw new Error(
        `messages[${messageIndex}].content[${blockIndex}].type "${String(parsed.type)}" is not supported`
      );
    });

    if (role === 'assistant') {
      translatedMessages.push({
        role: 'assistant',
        content: assistantTextParts.join('\n'),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });
      return;
    }

    if (userParts.length > 0 || !sawToolResult) {
      flushUserContent(translatedMessages, userParts);
    }
  });

  return translatedMessages;
}

export class ProxyRequestTransformer {
  transform(raw: unknown): ProxyOpenAIRequest {
    const source = assertObject(raw || {}, 'request') as AnthropicProxyRequestShape;
    const messages = transformMessages(source.messages);
    const system = source.system;
    const allMessages =
      system !== undefined
        ? [
            { role: 'system', content: flattenTextContent(system, 'system') } as OpenAIMessage,
            ...messages,
          ]
        : messages;

    return {
      model:
        typeof source.model === 'string' && source.model.trim().length > 0
          ? source.model.trim()
          : undefined,
      stream: source.stream === true,
      messages: allMessages,
      max_tokens: asNumber(source.max_tokens),
      temperature: asNumber(source.temperature),
      top_p: asNumber(source.top_p),
      stop: asStringArray(source.stop_sequences),
      metadata: asMetadata(source.metadata),
      tools: transformTools(source.tools),
      ...mapThinkingToReasoning(source.thinking),
    };
  }
}
