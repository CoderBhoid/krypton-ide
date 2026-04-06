import { TOOLS, ToolDefinition } from './toolDefinitions';

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface NormalizedMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  tool_calls?: NormalizedToolCall[];
  tool_call_id?: string;
}

/**
 * Adapter handles the differences between AI provider API formats
 */
export const ModelAdapters = {
  /**
   * Translates the standard internal tools into a provider-specific format
   */
  getToolsForProvider(provider: string): any[] {
    switch (provider) {
      case 'gemini':
        // Gemini expects an array of tool objects, each with function_declarations
        return [{
          function_declarations: TOOLS.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }];
        
      case 'anthropic':
        // Anthropic expects an array of tools with input_schema
        return TOOLS.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }));

      case 'openai':
      case 'groq':
      case 'mistral':
      case 'openrouter':
      default:
        // OpenAI-compatible providers
        return TOOLS;
    }
  },

  /**
   * Normalizes a provider's message response into our internal format
   */
  normalizeResponse(provider: string, data: any): NormalizedMessage {
    switch (provider) {
      case 'gemini': {
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        
        if (part?.functionCall) {
          return {
            role: 'assistant',
            tool_calls: [{
              id: `gemini-${Date.now()}`,
              name: part.functionCall.name,
              arguments: part.functionCall.args
            }]
          };
        }
        return { role: 'assistant', content: part?.text || '' };
      }

      case 'anthropic': {
        const toolUse = data.content?.find((p: any) => p.type === 'tool_use');
        const textPart = data.content?.find((p: any) => p.type === 'text');
        
        if (toolUse) {
          return {
            role: 'assistant',
            content: textPart?.text || '',
            tool_calls: [{
              id: toolUse.id,
              name: toolUse.name,
              arguments: toolUse.input
            }]
          };
        }
        return { role: 'assistant', content: textPart?.text || '' };
      }

      case 'openai':
      case 'groq':
      case 'mistral':
      case 'openrouter':
      default: {
        const message = data.choices?.[0]?.message;
        if (message?.tool_calls) {
          return {
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls.map((tc: any) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments)
            }))
          };
        }
        return { role: 'assistant', content: message?.content || '' };
      }
    }
  },

  /**
   * Parses a raw stream chunk from the provider into a partial message
   */
  parseStreamChunk(provider: string, chunkText: string): NormalizedMessage | null {
    try {
      let jsonStr = chunkText.trim();
      
      // OpenAI / Gemini (alt=sse) / Groq / Mistral (SSE format: data: {...})
      if (jsonStr.startsWith('data: ')) {
        jsonStr = jsonStr.replace(/^data: /, '').trim();
        if (jsonStr === '[DONE]') return null;
        
        const data = JSON.parse(jsonStr);
        
        // Gemini SSE format
        if (provider === 'gemini' || data.candidates) {
          const candidate = data.candidates?.[0];
          const part = candidate?.content?.parts?.[0];
          
          if (part?.functionCall) {
            return {
              role: 'assistant',
              tool_calls: [{
                id: `gemini-${Date.now()}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args
              }]
            };
          }
          return { role: 'assistant', content: part?.text || '' };
        }

        // OpenAI-compatible SSE format
        const delta = data.choices?.[0]?.delta;
        if (delta?.tool_calls) {
          return {
            role: 'assistant',
            tool_calls: delta.tool_calls.map((tc: any) => ({
              id: tc.id || tc.index,
              name: tc.function?.name,
              arguments: tc.function?.arguments || ''
            }))
          };
        }
        return { role: 'assistant', content: delta?.content || '' };
      }

      // Legacy/Direct JSON Fallback
      if (jsonStr.startsWith('{')) {
        const data = JSON.parse(jsonStr);
        // ... handled like Gemini above ...
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        return { role: 'assistant', content: part?.text || '' };
      }

      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Translates our internal history into provider-specific history format
   */
  formatHistoryForProvider(provider: string, messages: NormalizedMessage[]): any[] {
    switch (provider) {
      case 'gemini':
        // Gemini expects role: 'model' instead of 'assistant'
        // and uses contents array with parts
        return messages.map(m => {
          if (m.role === 'tool') {
            return {
              role: 'function',
              parts: [{ 
                functionResponse: {
                  name: m.name,
                  response: { content: m.content }
                } 
              }]
            };
          }
          if (m.tool_calls) {
            return {
              role: 'model',
              parts: [{
                functionCall: {
                  name: m.tool_calls[0].name,
                  args: m.tool_calls[0].arguments
                }
              }]
            };
          }
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || '' }]
          };
        });

      case 'anthropic':
        // Anthropic handles tool results as part of the messages stream
        return messages.map(m => {
          if (m.role === 'tool') {
            return {
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: m.tool_call_id,
                content: m.content
              }]
            };
          }
          if (m.tool_calls) {
            return {
              role: 'assistant',
              content: [
                ...(m.content ? [{ type: 'text', text: m.content }] : []),
                {
                  type: 'tool_use',
                  id: m.tool_calls[0].id,
                  name: m.tool_calls[0].name,
                  input: m.tool_calls[0].arguments
                }
              ]
            } as any;
          }
          return { role: m.role as any, content: m.content || '' };
        });

      default:
        // OpenAI format
        return messages.map(m => {
          if (m.role === 'tool') {
            return {
              role: 'tool',
              tool_call_id: m.tool_call_id,
              content: m.content
            };
          }
          if (m.tool_calls) {
             return {
               role: 'assistant',
               content: m.content,
               tool_calls: m.tool_calls.map(tc => ({
                 id: tc.id,
                 type: 'function',
                 function: {
                   name: tc.name,
                   arguments: JSON.stringify(tc.arguments)
                 }
               }))
             };
          }
          return { role: m.role, content: m.content };
        });
    }
  }
};
