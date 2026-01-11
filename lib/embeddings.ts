import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from "dotenv";
dotenv.config({ path: "./.env.local" });

type EmbeddingResult = {
  embedding: number[];
  model: string;
  provider: string;
};

const MAX_CHARS = 6000;
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = Math.max(1, Number(process.env.OUTPUT_DIMENSION ?? 1024));

function clip(text: string, max = MAX_CHARS) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function formatError(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/g, '')}${path}`;
}

async function requestEmbeddings(
  endpoint: string,
  apiKey: string,
  model: string,
  input: string | string[],
  provider: string,
  extraBody?: Record<string, unknown>,
  debug?: { enabled: boolean; label: string },
): Promise<EmbeddingResult> {
  const inputLength = Array.isArray(input)
    ? input.reduce((sum, item) => sum + item.length, 0)
    : input.length;
  const requestBody = {
    model,
    input,
    ...(extraBody ?? {}),
  };
  if (debug?.enabled) {
    console.log(
      `[embeddings][debug] request label=${debug.label} endpoint=${endpoint} body=${JSON.stringify(
        {
          model,
          inputType: Array.isArray(input) ? 'array' : 'string',
          inputLength,
          ...(extraBody ?? {}),
        },
      )}`,
    );
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const rawText = await res.text().catch(() => '');
  if (debug?.enabled) {
    const snippet = rawText.length > 600 ? `${rawText.slice(0, 600)}…` : rawText;
    console.log(
      `[embeddings][debug] response label=${debug.label} status=${res.status} contentType=${res.headers.get(
        'content-type',
      )} body=${snippet}`,
    );
  }

  const json = rawText ? JSON.parse(rawText) : null;
  if (!res.ok) {
    const message =
      typeof json === 'string'
        ? json
        : json?.error?.message || JSON.stringify(json || {}).slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${message}`);
  }

  const embedding =
    json?.data?.[0]?.embedding ?? 
    json?.embeddings?.[0] ?? 
    json?.embedding;
  
  if (!Array.isArray(embedding)) {
    throw new Error('Invalid embeddings response');
  }

  const normalized =
    embedding.length >= DEFAULT_DIMENSIONS
      ? (embedding as number[]).slice(0, DEFAULT_DIMENSIONS)
      : (embedding as number[]).concat(
          new Array(DEFAULT_DIMENSIONS - embedding.length).fill(0),
        );

  return {
    embedding: normalized,
    model: typeof json?.model === 'string' ? json.model : model,
    provider,
  };
}

export async function embedText(text: string): Promise<EmbeddingResult | null> {
  const input = clip(text);
  if (!input) return null;

  const debug = process.env.EMBEDDINGS_DEBUG === '1';
  const provider = process.env.EMBEDDINGS_PROVIDER?.trim().toLowerCase() || 'voyage';
  const baseUrl = process.env.EMBEDDINGS_BASE_URL?.trim() || 'https://api.voyageai.com';
  const voyageKey = process.env.VOYAGE_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  
  // Debug log for environment variables
  console.log(`[embeddings][debug] provider=${provider} baseUrl=${baseUrl} outputDim=${DEFAULT_DIMENSIONS}`);
  console.log(`[embeddings][debug] voyageKey=${voyageKey ? voyageKey.slice(0, 3) + "..." : "missing"}`);
  console.log(`[embeddings][debug] openaiKey=${openaiKey ? openaiKey.slice(0, 3) + "..." : "missing"}`);

  if (provider === 'voyage') {
    const voyageModel =
      process.env.EMBEDDINGS_MODEL?.trim() ||
      'voyage-1024';
    if (voyageKey) {
      try {
        return await requestEmbeddings(
          joinUrl(baseUrl, '/v1/embeddings'),
          voyageKey,
          voyageModel,
          [input],
          'voyage',
          { output_dimension: DEFAULT_DIMENSIONS },
          { enabled: debug, label: 'voyage' },
        );
      } catch (err) {
        console.warn(`[embeddings] voyage failed: ${formatError(err)}`);
      }
    }
  }

  const fallbackProvider = process.env.EMBEDDINGS_FALLBACK_PROVIDER?.trim().toLowerCase() || 'openai';
  if (fallbackProvider !== 'openai') return null;

  if (!openaiKey) return null;

  const openaiModel =
    process.env.EMBEDDINGS_FALLBACK_MODEL?.trim() ||
    process.env.OPENAI_EMBEDDINGS_MODEL?.trim() ||
    DEFAULT_MODEL;
  try {
    return await requestEmbeddings(
      'https://api.openai.com/v1/embeddings',
      openaiKey,
      openaiModel,
      input,
      'openai',
      { dimensions: DEFAULT_DIMENSIONS },
      { enabled: debug, label: 'openai' },
    );
  } catch (err) {
    console.warn(`[embeddings] fallback failed: ${formatError(err)}`);
    return null;
  }
}

export async function testVoyageEmbedding() {
  console.log('Starting embedding test...');
  try {
    const result = await embedText(
      'Test text to check Voyage embedding functionality.',
    );
    if (result) {
      console.log('Voyage embedding successful:', result);
    } else {
      console.log('Voyage embedding failed: No result returned.');
    }
  } catch (err) {
    console.log('Error in embedding with Voyage:', err);
  }
}

const isDirectRun = (() => {
  try {
    const metaUrl =
      typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : '';
    if (!metaUrl) return false;
    const selfPath = path.resolve(fileURLToPath(metaUrl));
    const mainPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return Boolean(mainPath) && selfPath === mainPath;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  testVoyageEmbedding().catch((err) => {
    console.log('Error in embedding with Voyage:', err);
  });
}
