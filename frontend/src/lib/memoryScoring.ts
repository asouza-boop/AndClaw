/**
 * NOTA DE DIVERGÊNCIA INTENCIONAL
 * 
 * Esta é uma aproximação client-side por sobreposição de tokens, usada apenas 
 * para exibição no MemoryInspector. NÃO reflete o ranking real usado na busca 
 * semântica, que vive em src/core/memory/ranking.ts (rankSemanticMemories), 
 * baseado em distância vetorial + usage/type bias. 
 * 
 * Os pesos aqui (0.72/0.28) são independentes e não devem ser "alinhados" 
 * aos pesos do backend — são fórmulas de natureza diferente (similarity 
 * aqui é overlap 0-1; no backend é distância vetorial).
 */

export const SIMILARITY_WEIGHT = 0.72;
export const RECENCY_WEIGHT = 0.28;

export function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

export function similarityScore(source: string, context: string) {
  const sourceTokens = tokenize(source);
  const contextTokens = tokenize(context);
  if (sourceTokens.size === 0 || contextTokens.size === 0) return 0;
  let matches = 0;
  sourceTokens.forEach((token) => {
    if (contextTokens.has(token)) matches += 1;
  });
  return matches / Math.max(sourceTokens.size, contextTokens.size);
}

export function recencyScore(createdAt?: string) {
  const timestamp = createdAt ? Date.parse(createdAt) : Date.now();
  const ageHours = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
  return 1 / (1 + ageHours / 24);
}

export function computeMemoryScore(similarity: number, recency: number) {
  return (similarity * SIMILARITY_WEIGHT) + (recency * RECENCY_WEIGHT);
}
