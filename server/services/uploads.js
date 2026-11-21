import crypto from 'node:crypto';
import { HttpError } from '../utils.js';

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 6;

/**
 * Las fotos se guardan como BLOB dentro de SQLite.
 * De esta forma Litestream las replica a Supabase Storage junto con la base,
 * sin depender de un disco persistente en Render Free.
 */
export function saveDataUrlPhoto(dataUrl, label = null) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new HttpError(400, 'Formato de imagen no admitido. Usá JPG, PNG o WebP.');
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new HttpError(400, 'La imagen está vacía.');
  if (buffer.length > MAX_BYTES) throw new HttpError(400, 'Cada imagen puede pesar hasta 5 MB.');

  return {
    fileName: `db-${crypto.randomUUID()}.${MIME_EXTENSIONS[mime]}`,
    mime,
    label,
    buffer,
  };
}

export function saveOrderPhotos(_orderId, photos = []) {
  if (!Array.isArray(photos)) return [];
  if (photos.length > MAX_PHOTOS) {
    throw new HttpError(400, `Podés adjuntar hasta ${MAX_PHOTOS} fotografías por ingreso.`);
  }
  return photos
    .filter((photo) => photo?.data_url)
    .map((photo) => saveDataUrlPhoto(photo.data_url, photo.label || null));
}

export function deleteOrderPhotos() {
  // Las fotos se eliminan en cascada con la orden (order_photos).
}

export const PHOTO_LIMITS = { maxBytes: MAX_BYTES, maxPhotos: MAX_PHOTOS };
