import fs from 'fs';
import path from 'path';
import { config } from '@/config/env';
import { readAudioBuffer } from '@/lib/audioStorage';

export async function transcribeAudio(filePath: string): Promise<string> {
  const apiKey = config.openai?.apiKey;
  if (!apiKey) throw new Error('WHISPER_NOT_CONFIGURED');

  let buffer: Buffer;
  let fileName: string;
  if (filePath.startsWith('lo:')) {
    const result = await readAudioBuffer(filePath);
    buffer = result.buffer;
    fileName = result.originalName;
  } else {
    // legacy /tmp path fallback for any rows already in DB
    buffer = await fs.promises.readFile(filePath);
    fileName = path.basename(filePath);
  }
  const ext = fileName.split('.').pop() || 'webm';
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
  };
  const mimeType = mimeMap[ext] || 'audio/webm';

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${body}`);
  }

  const data = await response.json() as { text: string };
  return data.text;
}
