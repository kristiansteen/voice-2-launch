// ── Local LLM client (offline mode) ───────────────────────────────────────────
// Mirrors the Anthropic SDK's `messages.create()` so every existing call site
// works unchanged, but sends the request to the local OpenAI-compatible server
// (llamafile / llama.cpp) and returns an Anthropic-shaped response.

import { LOCAL_ENDPOINTS } from '../config/offline.js';

/** Flatten Anthropic content (string or array of blocks) to plain text. */
export function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(b => b && (b.type === 'text' || typeof b.text === 'string'))
      .map(b => b.text)
      .join('\n');
  }
  return String(content);
}

/** Remove reasoning blocks some local models (e.g. Qwen) emit before the answer. */
export function stripReasoning(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '') // opening tag swallowed by the chat template
    .trim();
}

/** Anthropic `messages.create` params → OpenAI `chat/completions` body. */
export function toOpenAiBody(params) {
  const messages = [];
  const system = contentToText(params.system);
  if (system) messages.push({ role: 'system', content: system });
  for (const m of params.messages || []) {
    messages.push({ role: m.role, content: contentToText(m.content) });
  }
  return {
    model: 'local',
    messages,
    max_tokens: params.max_tokens,
    temperature: params.temperature ?? 0.2,
    // Qwen-family models: skip the slow "thinking" phase. Ignored by other models.
    chat_template_kwargs: { enable_thinking: false },
  };
}

/** OpenAI `chat/completions` response → Anthropic message shape. */
export function toAnthropicMessage(data) {
  const choice = data?.choices?.[0] || {};
  const text = stripReasoning(choice.message?.content ?? '');
  return {
    id: data?.id || 'local',
    type: 'message',
    role: 'assistant',
    model: data?.model || 'local',
    content: [{ type: 'text', text }],
    stop_reason: choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
    usage: {
      input_tokens: data?.usage?.prompt_tokens ?? 0,
      output_tokens: data?.usage?.completion_tokens ?? 0,
    },
  };
}

export function makeLocalClient() {
  return {
    messages: {
      async create(params) {
        let res;
        try {
          res = await fetch(LOCAL_ENDPOINTS.llm, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toOpenAiBody(params)),
          });
        } catch {
          throw new Error('Local model is not running. Start AILEAN with start-ailean.command.');
        }
        if (!res.ok) {
          const msg = await res.text().catch(() => '');
          throw new Error(`Local model error ${res.status}: ${msg.slice(0, 200)}`);
        }
        return toAnthropicMessage(await res.json());
      },
    },
  };
}
