import fs from 'fs';
import path from 'path';

export async function saveAudioBuffer(
  meetingId: string,
  buffer: Buffer,
  originalName: string
): Promise<string> {
  const dir = path.join('/tmp', 'andclaw-audio');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${meetingId}-${Date.now()}-${originalName}`;
  const filePath = path.join(dir, fileName);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}
