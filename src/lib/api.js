export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: { ...headers },
    signal,
  };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`/api${path}`, options);
  const text = await response.text();
  const data = parseBody(text);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('tt:unauthorized'));
    }
    throw new ApiError(data?.error || 'No se pudo completar la operación.', response.status, data?.details);
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, body, options) => request(path, { ...options, method: 'DELETE', body }),
};

export async function downloadFile(path, fallbackName = 'documento') {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!response.ok) {
    const text = await response.text();
    const data = parseBody(text);
    throw new ApiError(data?.error || 'No se pudo generar el archivo.', response.status, data?.details);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  let fileName = fallbackName;
  if (utfMatch) fileName = decodeURIComponent(utfMatch[1]);
  else if (plainMatch) fileName = plainMatch[1];
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return fileName;
}

export function assetUrl(path) {
  return path?.startsWith('/api') ? path : `/api${path}`;
}
