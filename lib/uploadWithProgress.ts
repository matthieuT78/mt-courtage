// Shared XHR upload helpers with real-time progress tracking.

/** Upload a file to a Supabase signed upload URL (PUT). */
export function xhrUploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload échoué (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau lors de l'upload."));
    xhr.send(file);
  });
}

/** Upload a file directly to Supabase Storage REST API (POST) with RLS auth token. */
export function xhrUploadDirect(
  supabaseUrl: string,
  bucket: string,
  path: string,
  accessToken: string,
  anonKey: string,
  file: File,
  onProgress: (pct: number) => void,
  upsert = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    if (upsert) xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload échoué (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau lors de l'upload."));
    xhr.send(file);
  });
}
