import imageCompression from "browser-image-compression";

const COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB
const TARGET_SIZE = 400 * 1024; // 400KB

export async function compressImageIfNeeded(file: File): Promise<File> {
  // Skip compression for small files
  if (file.size < COMPRESSION_THRESHOLD) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_SIZE / (1024 * 1024),
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/webp",
    });

    return new File([compressed], file.name.replace(/\.[^/.]+$/, ".webp"), {
      type: "image/webp",
    });
  } catch (error) {
    console.error("Image compression failed:", error);
    // Return original file if compression fails
    return file;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
