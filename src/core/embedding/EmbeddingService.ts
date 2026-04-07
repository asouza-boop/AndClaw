import crypto from 'crypto';
import { normalizeVector, VECTOR_DIMENSIONS } from '@/infra/db/vector';

type EmbeddingOptions = {
  provider?: 'openai-compatible' | 'local';
  endpoint?: string;
  apiKey?: string;
  model?: string;
  dimensions?: number;
};

export class EmbeddingService {
  private readonly provider: EmbeddingOptions['provider'];
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(options: EmbeddingOptions = {}) {
    this.provider = options.provider || (process.env.EMBEDDING_API_URL ? 'openai-compatible' : 'local');
    this.endpoint = options.endpoint || process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';
    this.apiKey = options.apiKey || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';
    this.model = options.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = options.dimensions || VECTOR_DIMENSIONS;
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = this.normalizeText(text);
    if (!cleanText) return new Array(this.dimensions).fill(0);

    if (this.provider === 'openai-compatible' && this.apiKey) {
      try {
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

        if (response.ok) {
          const data = await response.json() as any;
          const embedding = data?.data?.[0]?.embedding;
          if (Array.isArray(embedding) && embedding.length) {
            return normalizeVector(embedding);
          }
        }
      } catch (error) {
        console.warn('[EmbeddingService] provider embedding failed, falling back to local hash', error);
      }
    }

    return this.localEmbedding(cleanText);
  }

  private normalizeText(text: string): string {
    return String(text || '')
      .replace(/\u0000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private localEmbedding(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = text.match(/[\p{L}\p{N}_-]+/gu) || [];

    if (tokens.length === 0) {
      const digest = crypto.createHash('sha256').update(text).digest();
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] = (digest[i % digest.length] / 255) - 0.5;
      }
      return normalizeVector(vector);
    }

    const windowSize = Math.min(tokens.length, 64);
    for (let index = 0; index < windowSize; index++) {
      const token = tokens[index];
      const gram = `${index}:${token}`;
      const digest = crypto.createHash('sha256').update(gram).digest();
      for (let round = 0; round < 4; round++) {
        const offset = round * 4;
        const bucket = digest.readUInt32BE(offset) % this.dimensions;
        const sign = (digest[offset] & 1) === 0 ? 1 : -1;
        const weight = 1 / (1 + index * 0.1 + round * 0.05);
        vector[bucket] += sign * weight;
      }
    }

    for (let i = 0; i < Math.min(tokens.length - 1, 48); i++) {
      const bigram = `${tokens[i]}__${tokens[i + 1]}`;
      const digest = crypto.createHash('sha256').update(bigram).digest();
      const bucket = digest.readUInt32BE(0) % this.dimensions;
      vector[bucket] += 0.5;
    }

    return normalizeVector(vector);
  }
}
