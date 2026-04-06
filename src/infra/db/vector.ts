export const VECTOR_DIMENSIONS = 1536;

export function toVectorLiteral(values: number[]): string {
  const normalized = values.map((value) => Number.isFinite(value) ? Number(value.toFixed(8)) : 0);
  return `[${normalized.join(',')}]`;
}

export function clampVector(values: number[], size = VECTOR_DIMENSIONS): number[] {
  const out = new Array<number>(size).fill(0);
  for (let i = 0; i < Math.min(values.length, size); i++) {
    const value = Number(values[i]);
    out[i] = Number.isFinite(value) ? value : 0;
  }
  return out;
}

export function normalizeVector(values: number[]): number[] {
  const vector = clampVector(values);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}
