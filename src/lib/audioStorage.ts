import crypto from 'crypto';
import { config } from '@/config/env';

function getR2Endpoint(): string {
  return `https://${config.r2.accountId}.r2.cloudflarestorage.com`;
}

function hmacSHA256(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function buildAuthHeaders(
  method: string,
  objectKey: string,
  contentType: string,
  bodyHash: string,
  contentLength: number
): Record<string, string> {
  const bucket = config.r2.bucket;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const host = `${config.r2.accountId}.r2.cloudflarestorage.com`;

  const canonicalUri = `/${bucket}/${objectKey}`;
  const canonicalQueryString = '';
  const canonicalHeaders =
    `content-length:${contentLength}\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${bodyHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method, canonicalUri, canonicalQueryString,
    canonicalHeaders, signedHeaders, bodyHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, credentialScope,
    sha256(Buffer.from(canonicalRequest))
  ].join('\n');

  const signingKey = hmacSHA256(
    hmacSHA256(
      hmacSHA256(
        hmacSHA256(
          Buffer.from(`AWS4${config.r2.accessKey}`, 'utf8'),
          dateStamp
        ),
        region
      ),
      service
    ),
    'aws4_request'
  );

  const signature = hmacSHA256(signingKey, stringToSign).toString('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.r2.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authorization,
    'Content-Type': contentType,
    'Content-Length': String(contentLength),
    'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash,
  };
}

export async function saveAudioBuffer(
  meetingId: string,
  buffer: Buffer,
  originalName: string
): Promise<string> {
  if (!config.r2.accountId || !config.r2.accessKey) {
    throw new Error('R2_NOT_CONFIGURED');
  }

  const ext = originalName.split('.').pop() || 'webm';
  const objectKey = `${meetingId}-${Date.now()}.${ext}`;
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm',
    ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'audio/mp4',
  };
  const contentType = mimeMap[ext] || 'audio/webm';
  const bodyHash = sha256(buffer);

  const headers = buildAuthHeaders('PUT', objectKey, contentType, bodyHash, buffer.length);
  const url = `${getR2Endpoint()}/${config.r2.bucket}/${objectKey}`;

  const response = await fetch(url, { method: 'PUT', headers, body: new Uint8Array(buffer) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`R2 upload failed ${response.status}: ${body}`);
  }

  return `r2:${objectKey}`;
}

export async function readAudioBuffer(r2Ref: string): Promise<{ buffer: Buffer; originalName: string }> {
  if (!r2Ref.startsWith('r2:') && !r2Ref.startsWith('lo:')) throw new Error('INVALID_REF');

  // Legacy LO refs: cannot read from Neon LO — throw with clear message
  if (r2Ref.startsWith('lo:')) {
    throw new Error('LEGACY_LO_REF: audio stored in PostgreSQL LO is not supported on Neon. Re-upload the file.');
  }

  const objectKey = r2Ref.slice(3);
  const originalName = objectKey.split('-').slice(2).join('-') || objectKey;
  const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // empty body SHA256
  const headers = buildAuthHeaders('GET', objectKey, 'application/octet-stream', bodyHash, 0);
  const url = `${getR2Endpoint()}/${config.r2.bucket}/${objectKey}`;

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`R2 download failed ${response.status}: ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), originalName };
}

export async function deleteAudioObject(r2Ref: string): Promise<void> {
  if (!r2Ref.startsWith('r2:')) return; // skip legacy LO refs silently
  const objectKey = r2Ref.slice(3);
  const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const headers = buildAuthHeaders('DELETE', objectKey, 'application/octet-stream', bodyHash, 0);
  const url = `${getR2Endpoint()}/${config.r2.bucket}/${objectKey}`;
  await fetch(url, { method: 'DELETE', headers });
}
