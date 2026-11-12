/**
 * 把图片 URL（https:// 或 data:image/）转成程序品牌所需的两份数据：
 * - 32x32 RGBA，用于窗口标题栏/任务栏/托盘图标
 * - 多尺寸 .ico 文件字节，用于写入 exe 文件图标
 */

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function decodeBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    const bitmap = await createImageBitmap(blob)
    if (bitmap.width > 0 && bitmap.height > 0) return bitmap
  } catch {}
  // createImageBitmap 不支持的格式（部分 svg / ico）退回 img 解码
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('图片格式无法解析'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function loadImage(url: string) {
  let response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new Error(`图片加载失败（远程图片需要允许跨域，或改用本地上传）：${error?.message || error}`)
  }
  if (!response.ok) throw new Error(`图片加载失败 (${response.status})`)
  return decodeBlob(await response.blob())
}

/** 本地图片文件 → 压缩到 maxSize 内的 data URL，供品牌图标预览与持久化 */
export async function imageFileToDataUrl(file: Blob, maxSize = 512): Promise<string> {
  const image = await decodeBlob(file)
  const sourceWidth = image.width || 1
  const sourceHeight = image.height || 1
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

function drawSize(image, size) {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  // 保持宽高比居中，避免非方形图标被拉伸
  const sourceWidth = image.width || size
  const sourceHeight = image.height || size
  const scale = Math.min(size / sourceWidth, size / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
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
