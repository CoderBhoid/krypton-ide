import { useState, useEffect } from 'react';

export interface AIModel {
  id: string;
  name: string;
}

export function useDynamicModels(provider: string, apiKey?: string) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Anthropic Fallback (Static)
    if (provider === 'anthropic') {
      setModels([
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
        { id: 'claude-opus-4-6-20260205', name: 'Claude 4.6 Opus' },
      ]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Providers requiring API keys for listing
    if (!apiKey && provider !== 'openrouter') {
      setModels([]);
      setError('API key required to fetch models');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    async function fetchModels() {
      setIsLoading(true);
      setError(null);
      try {
        let url = '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        switch (provider) {
          case 'openai':
            url = 'https://api.openai.com/v1/models';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
          case 'grok':
            url = 'https://api.x.ai/v1/models';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
          case 'groq':
            url = 'https://api.groq.com/openai/v1/models';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
          case 'openrouter':
            url = 'https://openrouter.ai/api/v1/models';
            // No headers needed for OpenRouter public models
            break;
          case 'mistral':
            url = 'https://api.mistral.ai/v1/models';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
          case 'gemini':
            url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            break;
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: provider === 'gemini' || provider === 'openrouter' ? undefined : headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Request failed with status ${response.status}`);
        }

        const data = await response.json();
        let rawModels: any[] = [];

        if (provider === 'gemini') {
          // Google uses .models instead of .data
          rawModels = data.models || [];
        } else {
          rawModels = data.data || [];
        }

        const formattedModels: AIModel[] = rawModels.map((item: any) => {
          let id = item.id || item.name;
          // Strip models/ prefix for Gemini
          if (provider === 'gemini' && id.startsWith('models/')) {
            id = id.replace('models/', '');
          }
          return { id, name: id };
        });

        // Filter and Sort Alphabetically
        const sortedModels = formattedModels
          .filter(m => m.id)
          .sort((a, b) => a.id.localeCompare(b.id));

        setModels(sortedModels);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setError('Fetch timeout (10s)');
        } else {
          setError(err.message || 'Failed to fetch models');
        }
        setModels([]);
      } finally {
        setIsLoading(false);
        clearTimeout(timeoutId);
      }
    }

    fetchModels();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [provider, apiKey]);

  return { models, isLoading, error };
}
