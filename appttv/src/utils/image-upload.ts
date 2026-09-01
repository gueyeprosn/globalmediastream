const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Détection par en-tête binaire (magic bytes). */
export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function mimeFromFilename(filename?: string): string | null {
  const ext = filename?.split(".").pop()?.toLowerCase();
  return ext ? EXT_TO_MIME[ext] ?? null : null;
}

/** Normalise le type MIME (apps mobiles envoient souvent octet-stream ou rien). */
export function normalizeImageMime(
  mimetype: string | undefined,
  originalname?: string,
  buffer?: Buffer
): string | null {
  const mt = (mimetype ?? "").toLowerCase().trim();
  if (mt === "image/jpg") return "image/jpeg";
  if (mt === "image/jpeg" || mt === "image/png" || mt === "image/webp") return mt;

  const fromName = mimeFromFilename(originalname);
  if (fromName) return fromName;

  if (buffer?.length) {
    const sniffed = sniffImageMime(buffer);
    if (sniffed) return sniffed;
  }

  if (!mt || mt === "application/octet-stream") {
    return mimeFromFilename(originalname) ?? (buffer?.length ? sniffImageMime(buffer) : null);
  }

  return null;
}

export function isLikelyImageUpload(mimetype: string | undefined, originalname?: string): boolean {
  const mt = (mimetype ?? "").toLowerCase().trim();
  if (mt.startsWith("image/") || !mt || mt === "application/octet-stream") return true;
  const ext = originalname?.split(".").pop()?.toLowerCase();
  return Boolean(ext && EXT_TO_MIME[ext]);
}

export function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}
