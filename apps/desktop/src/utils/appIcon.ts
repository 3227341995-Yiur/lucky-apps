/**
 * 把图片 URL（https:// 或 data:image/）转成程序品牌所需的两份数据：
 * - 32x32 RGBA，用于窗口标题栏/任务栏/托盘图标
 * - 多尺寸 .ico 文件字节，用于写入 exe 文件图标
 */

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function loadImage(url) {
  const blob = await (await fetch(url)).blob()
  return createImageBitmap(blob)
}

function drawSize(image, size) {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size).data
}

// ICO 内的 BMP 条目：40 字节 BITMAPINFOHEADER + BGRA 像素（自下而上）+ AND 掩码（全 0）
function bmpEntry(rgba, size) {
  const maskStride = Math.ceil(size / 32) * 4
  const pixels = size * size * 4
  const buffer = new Uint8Array(40 + pixels + size * maskStride)
  const view = new DataView(buffer.buffer)
  view.setUint32(0, 40, true)
  view.setInt32(4, size, true)
  view.setInt32(8, size * 2, true)
  view.setUint16(12, 1, true)
  view.setUint16(14, 32, true)
  view.setUint32(20, pixels + size * maskStride, true)
  let cursor = 40
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4
      buffer[cursor++] = rgba[index + 2]
      buffer[cursor++] = rgba[index + 1]
      buffer[cursor++] = rgba[index]
      buffer[cursor++] = rgba[index + 3]
    }
  }
  return buffer
}

function buildIco(entries) {
  const count = entries.length
  const headerSize = 6 + count * 16
  const totalSize = entries.reduce((sum, entry) => sum + entry.data.length, headerSize)
  const ico = new Uint8Array(totalSize)
  const view = new DataView(ico.buffer)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, count, true)
  let offset = headerSize
  entries.forEach((entry, index) => {
    const head = 6 + index * 16
    view.setUint8(head, entry.size >= 256 ? 0 : entry.size)
    view.setUint8(head + 1, entry.size >= 256 ? 0 : entry.size)
    view.setUint16(head + 4, 1, true)
    view.setUint16(head + 6, 32, true)
    view.setUint32(head + 8, entry.data.length, true)
    view.setUint32(head + 12, offset, true)
    ico.set(entry.data, offset)
    offset += entry.data.length
  })
  return ico
}

export async function buildIconPayload(url) {
  const image = await loadImage(url)
  const entries = ICO_SIZES.map(size => ({ size, data: bmpEntry(drawSize(image, size), size) }))
  const ico = buildIco(entries)
  const rgba32 = drawSize(image, 32)
  return {
    rgba: Array.from(rgba32),
    width: 32,
    height: 32,
    ico: Array.from(ico),
  }
}

export default buildIconPayload
