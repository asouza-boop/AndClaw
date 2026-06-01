import { pool } from '@/db/postgres';

export async function saveAudioBuffer(
  meetingId: string,
  buffer: Buffer,
  originalName: string
): Promise<string> {
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    const loResult = await client.query('SELECT lo_create(0) AS oid');
    const oid = loResult.rows[0].oid as number;

    const CHUNK = 32768;
    for (let offset = 0; offset < buffer.length; offset += CHUNK) {
      const chunk = buffer.subarray(offset, offset + CHUNK);
      await client.query(
        `SELECT lowrite(lo_open($1, 131072), $2)`,
        [oid, chunk]
      );
    }

    await client.query('COMMIT');
    const ref = `lo:${oid}:${originalName}`;
    return ref;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function readAudioBuffer(loRef: string): Promise<{ buffer: Buffer; originalName: string }> {
  const parts = loRef.split(':');
  if (parts[0] !== 'lo' || parts.length < 3) throw new Error('INVALID_LO_REF');
  const oid = parseInt(parts[1], 10);
  const originalName = parts.slice(2).join(':');

  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    const fdResult = await client.query('SELECT lo_open($1, 40960) AS fd', [oid]);
    const fd = fdResult.rows[0].fd;

    const chunks: Buffer[] = [];
    const CHUNK = 32768;
    while (true) {
      const readResult = await client.query('SELECT loread($1, $2) AS data', [fd, CHUNK]);
      const chunk: Buffer = readResult.rows[0].data;
      if (!chunk || chunk.length === 0) break;
      chunks.push(chunk);
      if (chunk.length < CHUNK) break;
    }

    await client.query('SELECT lo_close($1)', [fd]);
    await client.query('COMMIT');
    return { buffer: Buffer.concat(chunks), originalName };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteAudioObject(loRef: string): Promise<void> {
  const parts = loRef.split(':');
  if (parts[0] !== 'lo' || parts.length < 3) return;
  const oid = parseInt(parts[1], 10);
  await pool!.query('SELECT lo_unlink($1)', [oid]);
}
