import { config } from '@/config/env';

const BASE_URL = 'https://api.raindrop.io/rest/v1';

function authHeaders(token?: string): HeadersInit | undefined {
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

export async function listRaindropCollections() {
  const token = config.raindrop.token;
  if (!token) return [];
  const res = await fetch(`${BASE_URL}/collections`, {
    headers: authHeaders(token)
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
    headers: authHeaders(token)
  });
  if (!res.ok) throw new Error('raindrop items failed');
  const data = await res.json();
  return data.items || [];
}

/**
 * Infers a topic tag from the URL domain for basic categorization.
 */
function inferTopic(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('github') || host.includes('gitlab')) return 'dev';
    if (host.includes('youtube') || host.includes('vimeo')) return 'video';
    if (host.includes('arxiv') || host.includes('scholar')) return 'research';
    if (host.includes('twitter') || host.includes('x.com') || host.includes('linkedin')) return 'social';
    if (host.includes('medium') || host.includes('substack') || host.includes('dev.to')) return 'article';
    if (host.includes('notion') || host.includes('docs.google')) return 'docs';
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves a link to Raindrop.io as a bookmark.
 * Fails gracefully — never throws.
 */
export async function saveToRaindrop(url: string, title?: string): Promise<{ ok: boolean; id?: number; error?: string }> {
  const token = config.raindrop.token;
  if (!token) return { ok: false, error: 'raindrop token not configured' };

  const tags = ['inbox'];
  const topic = inferTopic(url);
  if (topic) tags.push(topic);

  try {
    const collectionId = config.raindrop.collectionId ? Number(config.raindrop.collectionId) : 0;
    const res = await fetch(`${BASE_URL}/raindrop`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        link: url,
        title: title || url,
        tags,
        collection: { $id: collectionId || -1 }, // -1 = Unsorted in Raindrop
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      return { ok: false, error: `raindrop save failed: ${res.status} ${errData}` };
    }

    const data = await res.json();
    return { ok: true, id: data.item?._id };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
