import { normalizeVector, VECTOR_DIMENSIONS } from '@/infra/db/vector';

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

type EmbeddingOptions = {
  provider?: 'openai-compatible';
  endpoint?: string;
  apiKey?: string;
  model?: string;
  dimensions?: number;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class EmbeddingService {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(options: EmbeddingOptions = {}) {
    this.endpoint = options.endpoint || process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';
    this.apiKey = options.apiKey || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';
    this.model = options.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = options.dimensions || VECTOR_DIMENSIONS;
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = this.normalizeText(text);
    if (!cleanText) {
      // Empty input -> zero vector
      return new Array(this.dimensions).fill(0);
    }

    if (!this.apiKey) {
      throw new EmbeddingError('Missing API key for embeddings.');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: cleanText,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new EmbeddingError(`Provider embedding failed: ${response.status} ${response.statusText} ${errText}`);
    }

    const data = await response.json() as any;
    const embedding = data?.data?.[0]?.embedding;
    
    if (Array.isArray(embedding) && embedding.length) {
      return normalizeVector(embedding);
    }

    throw new EmbeddingError('Invalid or empty embedding returned from API');
  }

  public async generateBatch(texts: string[]): Promise<number[][]> {
    const batchSize = 20;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      
      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Failed item gets zero vector — caller can filter by checking all-zeros
          results.push(new Array(this.dimensions).fill(0));
        }
      }

      if (i + batchSize < texts.length) {
        await delay(100);
      }
    }

    return results;
  }

  private normalizeText(text: string): string {
    const clean = String(text || '')
      .replace(/\u0000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Truncate input to 8000 chars before sending (token limit safety)
    return clean.slice(0, 8000);
  }
}
