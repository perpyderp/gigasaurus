import sharp from 'sharp'

/**
 * Re-encode an image as WebP no wider than `maxWidth`. Wiki dossiers arrive as
 * ~3 MB 4000×2660 PNGs, but the widest slot they fill is ~730 CSS px (the
 * creature hero), so 1600 px covers 2× screens with room to spare.
 */
export async function toWebp(input: Uint8Array | string, maxWidth = 1600, quality = 82): Promise<Buffer> {
  return sharp(input).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer()
}
