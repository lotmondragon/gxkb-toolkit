import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Thin, mockable wrapper around the Anthropic Messages API. Every function in
 * this package that talks to Claude takes a {@link ClaudeCaller} instead of
 * constructing an SDK client directly, so tests can inject a fake one instead
 * of making real network calls.
 */
export interface ClaudeCaller {
  call(system: string, user: string, maxTokens?: number): Promise<string>;
}

export interface CreateClaudeCallerOptions {
  apiKey?: string;
  model?: string;
}

/** Creates a {@link ClaudeCaller} backed by the real Anthropic API. */
export function createClaudeCaller(options: CreateClaudeCallerOptions = {}): ClaudeCaller {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('No Anthropic API key found. Set ANTHROPIC_API_KEY or pass --api-key.');
  }
  const model = options.model ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  return {
    async call(system: string, user: string, maxTokens = 4096): Promise<string> {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      if (!textBlock) {
        throw new Error('Claude response contained no text content.');
      }
      return textBlock.text;
    },
  };
}
