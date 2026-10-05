export type PickedMenuImage = { uri: string; name: string; mimeType?: string | null };
type MenuImageRow = { name: string; url: string; is_active: boolean; sort_order: number };
type ImageUploadDependencies = {
  read: (file: PickedMenuImage) => Promise<ArrayBuffer>;
  upload: (path: string, bytes: ArrayBuffer, contentType: string) => Promise<string>;
  save: (row: MenuImageRow) => Promise<void>;
  remove: (path: string) => Promise<void>;
};
export async function uploadTVMenuImage(file: PickedMenuImage, sortOrder: number, dependencies: ImageUploadDependencies): Promise<void> {
  let stage = 'read the selected image';
  let uploadedPath: string | null = null;
  try {
    const bytes = await dependencies.read(file);
    if (!bytes.byteLength) throw new Error('The selected image is empty.');
    const extension = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || 'jpg';
    const contentType = file.mimeType || ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as Record<string, string>)[extension] || 'application/octet-stream';
    const path = `menus/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    stage = 'upload the image to storage';
    const url = await dependencies.upload(path, bytes, contentType);
    uploadedPath = path;
    stage = 'save the uploaded image';
    await dependencies.save({ name: file.name, url, is_active: true, sort_order: sortOrder });
  } catch (error) {
    let cleanupFailed = false;
    if (uploadedPath) {
      try { await dependencies.remove(uploadedPath); } catch { cleanupFailed = true; }
    }
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
    throw new Error(`Could not ${stage}: ${message}${cleanupFailed ? ' The uploaded file could not be cleaned up.' : ''}`);
  }
}
export function getImageDownloadName(name: string, url: string): string {
  const basename = name.split(/[\\/]/).pop() || 'menu-image';
  const safeName = basename.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim() || 'menu-image';
  if (/\.[a-zA-Z0-9]+$/.test(safeName)) return safeName;
  return `${safeName}.${url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'jpg'}`;
}

export async function downloadAndShareMenuImage(uri: string, dependencies: {
  download: (uri: string) => Promise<void>;
  share: (uri: string) => Promise<void>;
  remove: (uri: string) => Promise<void>;
}): Promise<void> {
  try {
    await dependencies.download(uri);
    await dependencies.share(uri);
    // Android's chooser can resolve before the recipient reads the file.
    // Leave successful downloads in cache for the OS to reclaim later.
  } catch (error) {
    await dependencies.remove(uri).catch(() => {});
    throw error;
  }
}
