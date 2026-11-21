import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../utils.js';

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 6;

export function saveDataUrlPhoto(orderId, dataUrl, label = null) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new HttpError(400, 'Formato de imagen no admitido. Usá JPG, PNG o WebP.');
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new HttpError(400, 'La imagen está vacía.');
  if (buffer.length > MAX_BYTES) throw new HttpError(400, 'Cada imagen puede pesar hasta 5 MB.');

  const directory = path.join(config.uploadDir, String(orderId));
  fs.mkdirSync(directory, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${MIME_EXTENSIONS[mime]}`;
  fs.writeFileSync(path.join(directory, fileName), buffer);
  return { fileName, mime, label };
}

export function saveOrderPhotos(orderId, photos = []) {
  if (!Array.isArray(photos)) return [];
  if (photos.length > MAX_PHOTOS) {
    throw new HttpError(400, `Podés adjuntar hasta ${MAX_PHOTOS} fotografías por ingreso.`);
  }
  return photos
    .filter((photo) => photo?.data_url)
    .map((photo) => saveDataUrlPhoto(orderId, photo.data_url, photo.label || null));
}

export function photoPath(orderId, fileName) {
  const safeName = path.basename(fileName);
  return path.join(config.uploadDir, String(orderId), safeName);
}

export function deleteOrderPhotos(orderId) {
  const directory = path.join(config.uploadDir, String(orderId));
  if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
}
