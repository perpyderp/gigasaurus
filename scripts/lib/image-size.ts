/** Width × height from PNG, JPEG or WebP bytes (header only, no decoding). */
export function imageSize(buf: Uint8Array): { width: number; height: number; type: 'png' | 'jpg' | 'webp' } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // PNG: signature, then IHDR width/height (big-endian) at 16/20
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: dv.getUint32(16), height: dv.getUint32(20), type: 'png' }
  }
  // JPEG: walk segments to the first SOFn marker
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]
      const len = dv.getUint16(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7), type: 'jpg' }
      }
      i += 2 + len
    }
    return null
  }
  // WebP: RIFF....WEBP then VP8 / VP8L / VP8X chunk
  if (String.fromCharCode(...buf.slice(0, 4)) === 'RIFF' && String.fromCharCode(...buf.slice(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...buf.slice(12, 16))
    if (chunk === 'VP8X') {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
      return { width: w, height: h, type: 'webp' }
    }
    if (chunk === 'VP8 ') return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff, type: 'webp' }
    if (chunk === 'VP8L') {
      const b = dv.getUint32(21, true)
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, type: 'webp' }
    }
  }
  return null
}

/** Dossiers are wide spreads (e.g. 4000×2660); infobox icons are small squares. */
export function looksLikeDossier(size: { width: number; height: number } | null): boolean {
  return !!size && size.width >= 1000 && size.width > size.height * 1.2
}
