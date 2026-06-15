const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type UploadProgressHandler = (percent: number) => void;

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vms_token');
}

/** POST multipart form data with upload progress (network phase capped at 90%). */
export function uploadFormData(
  path: string,
  formData: FormData,
  options?: { onProgress?: UploadProgressHandler },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (!options?.onProgress || !e.lengthComputable) return;
      const pct = Math.min(90, Math.round((e.loaded / e.total) * 90));
      options.onProgress(pct);
    });

    xhr.addEventListener('load', () => {
      options?.onProgress?.(95);
      resolve({ status: xhr.status, text: xhr.responseText });
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.send(formData);
  });
}

export function handleUploadAuthError(status: number): void {
  if (status !== 401) return;
  localStorage.removeItem('vms_token');
  localStorage.removeItem('vms_user');
  localStorage.removeItem('vms_permissions');
  localStorage.setItem('vms_logout_reason', 'Session expired. Please log in again.');
  window.location.href = '/login';
}
