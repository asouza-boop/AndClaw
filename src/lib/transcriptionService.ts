import { config } from '@/config/env';
import { readAudioBuffer } from '@/lib/audioStorage';
import fs from 'fs';
import path from 'path';

const GEMINI_TRANSCRIPTION_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getGeminiKey(): string {
  const keys = [
    config.llm.geminiKey,
    config.llm.geminiKey2,
    config.llm.geminiKey3,
  ].filter(Boolean);
  if (keys.length === 0) throw new Error('GEMINI_NOT_CONFIGURED');
  return keys[0];
}

export async function transcribeAudio(filePath: string): Promise<string> {
  const apiKey = getGeminiKey();

  const { buffer, originalName: resolvedName } = await readAudioBuffer(filePath).catch(() =>
    fs.promises.readFile(filePath).then(buf => ({ buffer: buf, originalName: path.basename(filePath) }))
  );

  const ext = resolvedName.split('.').pop() || 'webm';
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
  };
  const mimeType = mimeMap[ext] || 'audio/webm';
  const base64Audio = buffer.toString('base64');

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Audio,
            },
          },
          {
            text: 'Transcreva o áudio a seguir na íntegra em Português (PT-BR). Retorne apenas a transcrição, sem comentários adicionais.',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
    },
  };

  const url = `${GEMINI_API_BASE}/${GEMINI_TRANSCRIPTION_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    // Try second key on 429 or auth error
    if ((response.status === 429 || response.status === 403) && config.llm.geminiKey2) {
      return transcribeWithKey(config.llm.geminiKey2, body, mimeType);
    }
    throw new Error(`Gemini transcription error ${response.status}: ${errBody}`);
  }

  const data = await response.json() as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini transcription returned empty response');
  return text.trim();
}

async function transcribeWithKey(apiKey: string, body: any, _mimeType: string): Promise<string> {
  const url = `${GEMINI_API_BASE}/${GEMINI_TRANSCRIPTION_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini transcription fallback error ${response.status}: ${errBody}`);
  }
  const data = await response.json() as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini transcription fallback returned empty response');
  return text.trim();
}
