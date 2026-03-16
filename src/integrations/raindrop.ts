import { config } from '../config/env';

const BASE_URL = 'https://api.raindrop.io/rest/v1';

function authHeaders(token?: string) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function listRaindropCollections() {
  const token = config.raindrop.token;
  if (!token) return [];
  const res = await fetch(`${BASE_URL}/collections`, {
    headers: { ...authHeaders(token) }
  });
  if (!res.ok) throw new Error('raindrop collections failed');
  const data = await res.json();
  return data.items || [];
}

export async function listRaindrops(collectionId?: string, perpage = 30, page = 0) {
  const token = config.raindrop.token;
  if (!token) return [];
  const col = collectionId || config.raindrop.collectionId || '0';
  const res = await fetch(`${BASE_URL}/raindrops/${col}?perpage=${perpage}&page=${page}`, {
    headers: { ...authHeaders(token) }
  });
  if (!res.ok) throw new Error('raindrop items failed');
  const data = await res.json();
  return data.items || [];
}
