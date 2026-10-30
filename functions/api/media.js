const VIDEO_MAX_BYTES = 80 * 1024 * 1024;
const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
const MAX_DURATION_SECONDS = 300;
const ALLOWED_TYPES = {
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'])
};
const EXTENSIONS = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm'
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
}
function getConfig(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_ANON_KEY || '');
  if (!url || !key || !env.MEDIA_BUCKET) throw new Error('Cloudflare Workers needs SUPABASE_URL, SUPABASE_ANON_KEY and the MEDIA_BUCKET R2 binding.');
  return { url, key };
}
async function authenticate(request, env, config) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.key, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user || !user.id) return null;
  // Only explicitly allowlisted Supabase user IDs may upload, publish or delete media.
  // Configure MEDIA_ADMIN_USER_IDS as a Cloudflare secret/variable (comma-separated UUIDs).
  const allowedIds = String(env.MEDIA_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!allowedIds.includes(user.id)) return null;
  return { id: user.id, token };
}
async function dbRequest(config, token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', config.key);
  headers.set('Authorization', `Bearer ${token || config.key}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${config.url}/rest/v1/${path}`, { ...init, headers });
}
function safeSocialUrl(raw) {
  if (!raw) return '';
  try { const u = new URL(raw); return u.protocol === 'https:' ? u.href : null; } catch (_) { return null; }
}
function safeKey(key) {
  return typeof key === 'string' && /^media\/(video|audio)\/(?:[1-9]|10)\/[a-f0-9-]+\.(?:mp4|webm|mov|mp3|m4a|aac|wav|ogg)$/.test(key);
}

export async function onRequest(context) {
  const { request, env } = context;
  let config;
  try { config = getConfig(env); } catch (e) { return json({ error: e.message }, 503); }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Allow': 'GET, POST, DELETE, OPTIONS' } });
  if (request.method === 'GET' || request.method === 'HEAD') return servePublishedMedia(request, env, config);
  if (request.method === 'POST') return uploadOrUpdate(request, env, config);
  if (request.method === 'DELETE') return deleteMedia(request, env, config);
  return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, DELETE, OPTIONS' });
}

async function servePublishedMedia(request, env, config) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!safeKey(key)) return json({ error: 'Media not found.' }, 404);
  const q = new URLSearchParams({ select: 'object_key,mime_type', object_key: `eq.${key}`, status: 'eq.published', limit: '1' });
  const lookup = await dbRequest(config, null, `media_slots?${q.toString()}`);
  if (!lookup.ok) return json({ error: 'Could not verify media visibility.' }, 502);
  const rows = await lookup.json();
  if (!rows.length) return json({ error: 'Media not found.' }, 404);
  const head = await env.MEDIA_BUCKET.head(key);
  if (!head) return json({ error: 'Media file not found.' }, 404);
  const headers = new Headers({
    'Content-Type': rows[0].mime_type || head.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Disposition': 'inline', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600', 'ETag': head.httpEtag || ''
  });
  const rangeHeader = request.headers.get('Range');
  let object;
  let status = 200;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
    let start, end;
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, head.size - suffix); end = head.size - 1; }
    else { start = Number(match[1]); end = match[2] ? Number(match[2]) : head.size - 1; }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= head.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
    end = Math.min(end, head.size - 1);
    object = await env.MEDIA_BUCKET.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!object) return json({ error: 'Media file not found.' }, 404);
    headers.set('Content-Range', `bytes ${start}-${end}/${head.size}`);
    headers.set('Content-Length', String(end - start + 1));
    status = 206;
  } else {
    object = await env.MEDIA_BUCKET.get(key);
    if (!object) return json({ error: 'Media file not found.' }, 404);
    headers.set('Content-Length', String(head.size));
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

async function uploadOrUpdate(request, env, config) {
  const admin = await authenticate(request, env, config);
  if (!admin) return json({ error: 'Sign in with your Supabase admin account first.' }, 401);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length && length > VIDEO_MAX_BYTES + 1024 * 1024) return json({ error: 'Upload request is too large.' }, 413);
  let form;
  try { form = await request.formData(); } catch (_) { return json({ error: 'Expected a multipart media upload.' }, 400); }
  const type = String(form.get('type') || ''), slot = Number(form.get('slot'));
  if (!['video', 'audio'].includes(type) || !Number.isInteger(slot) || slot < 1 || slot > 10) return json({ error: 'Choose a valid audio/video slot from 1 to 10.' }, 400);
  const title = String(form.get('title') || '').trim().slice(0, 120);
  const description = String(form.get('description') || '').trim().slice(0, 300);
  const social = safeSocialUrl(String(form.get('socialUrl') || '').trim());
  const status = String(form.get('status') || 'draft');
  const duration = Number(form.get('durationSeconds') || 0);
  if (!title) return json({ error: 'A display title is required.' }, 400);
  if (social === null) return json({ error: 'Social links must use HTTPS.' }, 400);
  if (!['draft', 'published'].includes(status)) return json({ error: 'Invalid visibility setting.' }, 400);
  if (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_SECONDS) return json({ error: 'Media must be five minutes or less.' }, 400);

  const lookupQ = new URLSearchParams({ select: 'id,author_id,object_key,mime_type,size_bytes,duration_seconds,media_type,slot_number', media_type: `eq.${type}`, slot_number: `eq.${slot}`, limit: '1' });
  const existingResponse = await dbRequest(config, admin.token, `media_slots?${lookupQ.toString()}`);
  if (!existingResponse.ok) return json({ error: 'Could not read the current slot. Run the media database migration first.' }, 400);
  const existingRows = await existingResponse.json();
  const existing = existingRows[0] || null;
  if (existing && existing.author_id !== admin.id) return json({ error: 'This slot belongs to another author.' }, 403);
  const file = form.get('file');
  const hasFile = file && typeof file === 'object' && typeof file.stream === 'function' && file.size > 0;
  let objectKey = existing?.object_key || null;
  let mimeType = existing?.mime_type || null;
  let sizeBytes = Number(existing?.size_bytes || 0);
  let durationSeconds = hasFile ? duration : Number(existing?.duration_seconds || duration || 0);
  let uploadedKey = null;
  if (hasFile) {
    const max = type === 'video' ? VIDEO_MAX_BYTES : AUDIO_MAX_BYTES;
    if (!ALLOWED_TYPES[type].has(file.type)) return json({ error: `Unsupported ${type} format. Choose one of the formats shown in the admin panel.` }, 415);
    if (file.size > max) return json({ error: `File exceeds the ${type === 'video' ? '80 MB' : '20 MB'} limit.` }, 413);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) return json({ error: 'Media must be five minutes or less.' }, 400);
    const ext = EXTENSIONS[file.type];
    objectKey = `media/${type}/${slot}/${crypto.randomUUID()}.${ext}`;
    try { await env.MEDIA_BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } }); }
    catch (_) { return json({ error: 'Cloudflare R2 upload failed. Check the MEDIA_BUCKET binding.' }, 502); }
    uploadedKey = objectKey;
    mimeType = file.type;
    sizeBytes = file.size;
  } else if (!existing) {
    return json({ error: 'Choose a media file for this empty slot.' }, 400);
  }

  const row = { media_type: type, slot_number: slot, title, description, social_url: social || null, object_key: objectKey, mime_type: mimeType, size_bytes: sizeBytes, duration_seconds: Math.round(durationSeconds), status, author_id: admin.id, updated_at: new Date().toISOString() };
  const upsertQ = new URLSearchParams({ on_conflict: 'media_type,slot_number' });
  const saved = await dbRequest(config, admin.token, `media_slots?${upsertQ.toString()}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) });
  if (!saved.ok) {
    if (uploadedKey) await env.MEDIA_BUCKET.delete(uploadedKey).catch(() => {});
    const detail = await saved.text().catch(() => '');
    return json({ error: detail.includes('media_slots') ? 'Media database table or policies are missing. Run supabase/media-complete-migration.sql.' : 'Could not save media metadata. Check Supabase RLS policies.' }, 400);
  }
  const savedRows = await saved.json();
  if (existing?.object_key && uploadedKey && existing.object_key !== uploadedKey) await env.MEDIA_BUCKET.delete(existing.object_key).catch(() => {});
  return json({ ok: true, media: savedRows[0] || row, mediaUrl: `/api/media?key=${encodeURIComponent(objectKey)}` });
}

async function deleteMedia(request, env, config) {
  const admin = await authenticate(request, env, config);
  if (!admin) return json({ error: 'Sign in with your Supabase admin account first.' }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Expected JSON with media type and slot.' }, 400); }
  const type = String(body.type || ''), slot = Number(body.slot);
  if (!['video', 'audio'].includes(type) || !Number.isInteger(slot) || slot < 1 || slot > 10) return json({ error: 'Invalid media slot.' }, 400);
  const q = new URLSearchParams({ select: 'author_id,object_key,media_type,slot_number', media_type: `eq.${type}`, slot_number: `eq.${slot}`, limit: '1' });
  const lookup = await dbRequest(config, admin.token, `media_slots?${q.toString()}`);
  if (!lookup.ok) return json({ error: 'Could not read the media slot.' }, 400);
  const rows = await lookup.json();
  const existing = rows[0];
  if (!existing) return json({ error: 'That media slot is already empty.' }, 404);
  if (existing.author_id !== admin.id) return json({ error: 'You cannot delete another author’s media.' }, 403);
  const deleted = await dbRequest(config, admin.token, `media_slots?${new URLSearchParams({ media_type: `eq.${type}`, slot_number: `eq.${slot}` }).toString()}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  if (!deleted.ok) return json({ error: 'Could not delete media metadata. Check Supabase RLS policies.' }, 400);
  if (existing.object_key) await env.MEDIA_BUCKET.delete(existing.object_key).catch(() => {});
  return json({ ok: true });
}
