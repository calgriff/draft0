/**
 * Regenerate the draft0 app icons from the canonical logo: a `0` set in IBM
 * Plex Mono SemiBold with a text caret to its right.
 *
 * Run with `pnpm tsx scripts/generate-branding.ts`. Committed output lives in
 * packages/desktop/build/icons and packages/desktop/static, so this only needs
 * running when the mark itself changes.
 *
 * The glyph is rasterised straight from the vendored TTF rather than through a
 * font-family lookup: fontconfig is not guaranteed to know about a font that
 * only exists inside this repo, and the icons must come out identical on every
 * machine and in CI.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DESKTOP = path.join(ROOT, 'packages', 'desktop')
const FONT = path.join(DESKTOP, 'build', 'branding', 'IBMPlexMono-SemiBold.ttf')
const ICON_DIR = path.join(DESKTOP, 'build', 'icons')
const STATIC_DIR = path.join(DESKTOP, 'static')

// Proportions are expressed against a 1024px master and scaled down, so every
// size is the same mark rather than a separately-tuned drawing.
const MASTER = 1024
const BACKGROUND = '#16181d'
const INK = '#f2f4f7'
const CARET = '#21b56f'
const CORNER_RADIUS = 224
const DIGIT_HEIGHT = 470
const CARET_WIDTH = 68
const CARET_GAP = 78

/** Render the `0` on its own so its true rasterised width can be measured. */
const renderDigit = async(): Promise<{ data: Buffer; width: number; height: number }> => {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${INK}">0</span>`,
      fontfile: FONT,
      font: 'IBM Plex Mono SemiBold',
      rgba: true,
      dpi: 3600
    }
  })
    .png()
    .toBuffer({ resolveWithObject: true })

  const scale = DIGIT_HEIGHT / info.height
  const width = Math.round(info.width * scale)
  const resized = await sharp(data).resize(width, DIGIT_HEIGHT).png().toBuffer()
  return { data: resized, width, height: DIGIT_HEIGHT }
}

const buildMaster = async(): Promise<Buffer> => {
  const digit = await renderDigit()

  // Centre the whole mark (digit + gap + caret) rather than the digit alone,
  // otherwise the caret pushes the composition visibly off-axis.
  const markWidth = digit.width + CARET_GAP + CARET_WIDTH
  const left = Math.round((MASTER - markWidth) / 2)
  const top = Math.round((MASTER - DIGIT_HEIGHT) / 2)

  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MASTER}" height="${MASTER}">
      <rect width="${MASTER}" height="${MASTER}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="${BACKGROUND}"/>
      <rect x="${left + digit.width + CARET_GAP}" y="${top}" width="${CARET_WIDTH}" height="${DIGIT_HEIGHT}"
            rx="${CARET_WIDTH / 2}" ry="${CARET_WIDTH / 2}" fill="${CARET}"/>
    </svg>`
  )

  return sharp(background)
    .composite([{ input: digit.data, left, top }])
    .png()
    .toBuffer()
}

const resize = (master: Buffer, size: number): Promise<Buffer> =>
  sharp(master).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9 }).toBuffer()

/**
 * ICO container: a 6-byte header, one 16-byte directory entry per image, then
 * the PNG payloads. PNG-compressed entries have been valid since Windows Vista.
 */
const buildIco = (images: { size: number; data: Buffer }[]): Buffer => {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries: Buffer[] = []
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16)
    // 256 is encoded as 0 — the field is a single byte.
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2) // palette size
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

/** ICNS chunk types keyed by pixel size, for the PNG-payload variants. */
const ICNS_TYPES: Record<number, string> = {
  32: 'ic11',
  64: 'ic12',
  128: 'ic07',
  256: 'ic08',
  512: 'ic09',
  1024: 'ic10'
}

const buildIcns = (images: { size: number; data: Buffer }[]): Buffer => {
  const chunks: Buffer[] = []
  for (const { size, data } of images) {
    const type = ICNS_TYPES[size]
    if (!type) continue
    const header = Buffer.alloc(8)
    header.write(type, 0, 'ascii')
    header.writeUInt32BE(data.length + 8, 4)
    chunks.push(header, data)
  }

  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([header, body])
}

const run = async(): Promise<void> => {
  if (!fs.existsSync(FONT)) {
    throw new Error(`Missing ${FONT}. The IBM Plex Mono SemiBold TTF is vendored under build/branding.`)
  }

  const master = await buildMaster()

  const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
  const rendered = new Map<number, Buffer>()
  for (const size of pngSizes) {
    rendered.set(size, await resize(master, size))
  }

  // One PNG per size directory, named after the executable so the Linux
  // desktop entry's `Icon=draft0` resolves once the set is installed into
  // hicolor.
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    const dir = path.join(ICON_DIR, `${size}x${size}`)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'draft0.png'), rendered.get(size)!)
  }

  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const ico = buildIco(icoSizes.map((size) => ({ size, data: rendered.get(size)! })))
  const icns = buildIcns(
    [32, 64, 128, 256, 512, 1024].map((size) => ({ size, data: rendered.get(size)! }))
  )

  fs.writeFileSync(path.join(ICON_DIR, 'icon.png'), rendered.get(512)!)
  fs.writeFileSync(path.join(ICON_DIR, 'icon.ico'), ico)
  fs.writeFileSync(path.join(ICON_DIR, 'icon.icns'), icns)
  fs.writeFileSync(path.join(STATIC_DIR, 'icon.png'), rendered.get(512)!)
  fs.writeFileSync(path.join(STATIC_DIR, 'icon.ico'), ico)
  fs.writeFileSync(path.join(STATIC_DIR, 'icon.icns'), icns)
  fs.writeFileSync(path.join(STATIC_DIR, 'logo-96px.png'), rendered.get(128)!)
  fs.writeFileSync(path.join(STATIC_DIR, 'logo-small.png'), rendered.get(64)!)
  fs.writeFileSync(
    path.join(DESKTOP, 'src', 'renderer', 'src', 'assets', 'images', 'logo.png'),
    rendered.get(256)!
  )

  console.log('Wrote draft0 icons to build/icons and static/.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
