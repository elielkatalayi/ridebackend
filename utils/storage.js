const path = require('path');
const { supabase } = require('./supabase');

async function ensureBucket(bucket) {
  if (!supabase) throw new Error('Supabase client not initialized');
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    // Si le bucket n'existe pas ou une erreur est retournée, on tente de le créer
    if (error || !data) {
      const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
      // Ignore l'erreur si le bucket existe déjà
      if (createErr && !String(createErr.message || '').toLowerCase().includes('already exists')) {
        throw createErr;
      }
    }
  } catch (e) {
    // Dernier recours: tenter une création directe
    try {
      await supabase.storage.createBucket(bucket, { public: true });
    } catch (_) {
      // ignore
    }
  }
}

function randomName(originalName) {
  const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName || '.bin') || '.bin';
  return `${base}${ext}`;
}

async function uploadToSupabase(bucket, directory, fileBuffer, contentType, originalName) {
  if (!supabase) throw new Error('Supabase client not initialized');
  await ensureBucket(bucket);
  const filename = randomName(originalName);
  const filePath = directory ? `${directory}/${filename}` : filename;
  const logId = Date.now();
  console.log(`[uploadToSupabase:${logId}] start`, { bucket, directory, contentType, originalName, size: fileBuffer?.length, filePath });

  const attemptUpload = async () => (
    await supabase.storage.from(bucket).upload(filePath, fileBuffer, { contentType, upsert: true })
  );

  let { error } = await attemptUpload();
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    console.error(`[uploadToSupabase:${logId}] first error`, { message: error.message, name: error.name, statusCode: error.statusCode });
    if (msg.includes('bucket not found') || msg.includes('does not exist') || msg.includes('not found')) {
      await ensureBucket(bucket);
      ({ error } = await attemptUpload());
    }
  }
  if (error) throw new Error(error.message || 'Upload failed');

  const { data: publicData } = await supabase.storage.from(bucket).getPublicUrl(filePath);
  console.log(`[uploadToSupabase:${logId}] success`, { publicUrl: publicData.publicUrl, filePath });
  return { url: publicData.publicUrl, path: filePath };
}

function pickBucketForMessage(mime, isGroup = false) {
  const isImage = String(mime).startsWith('image/');
  const isAudio = String(mime).startsWith('audio/');
  const isVideo = String(mime).startsWith('video/');
  const isDocument = !isImage && !isAudio && !isVideo;
  if (isImage) return isGroup ? 'imagesgroupes' : 'imagesmessages';
  if (isAudio) return isGroup ? 'audiosgroupes' : 'audiosmessages';
  // Pas de catégorie vidéo explicitement listée: ranger dans documents*
  if (isVideo) return isGroup ? 'documentsgroupes' : 'documentsmessages';
  return isGroup ? 'documentsgroupes' : 'documentsmessages';
}

module.exports = { uploadToSupabase, pickBucketForMessage, ensureBucket };