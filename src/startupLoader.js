/**
 * 启动加载动画：逐字描边 loading + 粒子收尾。
 * 配置保存在 localStorage；启动时同步读取，不依赖数据库。
 */
import { animate, createTimeline, stagger, utils } from 'animejs'

const STYLE_ID = 'startup-loader-style'
const STORAGE_KEY = 'wr:loading'
const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_PALETTE = '#3574f0,#36a3ff,#67c23a,#e6a23c,#f56c6c,#8b5cf6'

const FONTS = [
  { value: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive', label: '手写体' },
  { value: 'Georgia, "Times New Roman", serif', label: '衬线体' },
  { value: '"Cascadia Code", Consolas, monospace', label: '等宽体' },
  { value: 'system-ui, "Microsoft YaHei", sans-serif', label: '无衬线体' }
]

export const LOADING_FONT_OPTIONS = FONTS

export const DEFAULT_LOADING_CONFIG = {
  text: 'loading',
  subtitle: '正在加载资源',
  font: FONTS[0].value,
  fontSize: 76,
  color: '#3574f0',
  background: '',
  effect: 'explode',
  particleCount: 8,
  particleShape: 'mixed',
  particleColors: DEFAULT_PALETTE,
  showPen: true,
  speed: 1
}

function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_LOADING_CONFIG, ...raw }
  config.text = String(config.text || 'loading').slice(0, 40)
  config.subtitle = String(config.subtitle ?? '')
  config.fontSize = Math.min(140, Math.max(28, Number(config.fontSize) || 76))
  config.particleCount = Math.min(30, Math.max(0, Number(config.particleCount) || 0))
  config.speed = Math.min(2.5, Math.max(0.4, Number(config.speed) || 1))
  config.effect = ['explode', 'dissolve', 'spark'].includes(config.effect) ? config.effect : 'explode'
  config.particleShape = ['mixed', 'circle', 'square', 'star'].includes(config.particleShape)
    ? config.particleShape
    : 'mixed'
  config.showPen = config.showPen !== false
  return config
}

export function readLoadingConfig() {
  try {
    return normalizeConfig(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return normalizeConfig()
  }
}

export function saveLoadingConfig(patch = {}) {
  const next = normalizeConfig({ ...readLoadingConfig(), ...patch })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage 不可用时仅当前会话生效
  }
  return next
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .startup-loader {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--el-bg-color-page, #f5f7fa);
      overflow: hidden;
    }

    html.dark .startup-loader {
      background: var(--el-bg-color-page, #141414);
    }

    .startup-word {
      width: min(520px, 84vw);
      overflow: visible;
    }

    .startup-word text {
      font-family: var(--startup-font, "Segoe Script", cursive);
      font-size: var(--startup-size, 76px);
      font-weight: 400;
      fill: var(--startup-ink, #3574f0);
      stroke: var(--startup-ink, #3574f0);
      stroke-width: 1.1;
      stroke-linejoin: round;
      paint-order: stroke fill;
      opacity: 0;
    }

    .startup-pen {
      fill: var(--startup-ink, #3574f0);
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--startup-ink, #3574f0) 55%, transparent));
    }

    .startup-sub {
      margin-top: 14px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--startup-ink, #909399);
      opacity: 0;
    }

    .startup-particles {
      position: fixed;
      inset: 0;
      z-index: 100001;
      pointer-events: none;
      overflow: hidden;
    }

    .startup-particle {
      position: fixed;
      border-radius: 50%;
      background: var(--startup-ink, #3574f0);
      will-change: transform, opacity;
    }

    .startup-particle.is-square { border-radius: 2px; }
    .startup-particle.is-star {
      border-radius: 0;
      clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%);
    }
  `
  document.head.appendChild(style)
}

function removePlaceholder() {
  document.getElementById('boot-placeholder')?.remove()
}

function svgEl(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value)
  return element
}

function particleColors(config) {
  const colors = String(config.particleColors || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return colors.length ? colors : [config.color]
}

function pickShape(config, index) {
  if (config.particleShape !== 'mixed') return config.particleShape
  return ['circle', 'square', 'star'][index % 3]
}

/**
 * 启动 / 预览加载动画。
 * @param {{preview?: boolean, config?: object}} options
 */
export function startStartupLoader(options = {}) {
  if (typeof document === 'undefined') return
  if (options.preview) {
    window.__startupLoader?.finish?.()
    document.querySelectorAll('.startup-loader, .startup-particles').forEach(node => node.remove())
  } else if (window.__startupLoader) {
    return
  }

  const config = normalizeConfig({ ...readLoadingConfig(), ...(options.config || {}) })
  ensureStyles()
  removePlaceholder()

  const overlay = document.createElement('div')
  overlay.className = 'startup-loader'
  if (config.background) overlay.style.background = config.background
  overlay.style.setProperty('--startup-ink', config.color)
  overlay.style.setProperty('--startup-font', config.font)
  overlay.style.setProperty('--startup-size', `${config.fontSize}px`)

  const svg = svgEl('svg', { class: 'startup-word', viewBox: '0 0 520 130', 'aria-hidden': 'true' })
  const defs = svgEl('defs')
  svg.appendChild(defs)
  const sub = document.createElement('div')
  sub.className = 'startup-sub'
  sub.textContent = config.subtitle
  overlay.append(svg, sub)
  document.body.appendChild(overlay)

  // 逐字排布，每个字符独立裁剪、独立绘制
  const letters = []
  let cursor = 18
  for (const [index, char] of [...config.text].entries()) {
    const text = svgEl('text', { x: cursor, y: 92 })
    text.textContent = char === ' ' ? ' ' : char
    svg.appendChild(text)

    const width = Math.max(1, text.getComputedTextLength())
    const clip = svgEl('clipPath', { id: `startup-clip-${index}` })
    const rect = svgEl('rect', { x: cursor - 2, y: 8, width: 0, height: 118 })
    clip.appendChild(rect)
    defs.appendChild(clip)
    text.setAttribute('clip-path', `url(#startup-clip-${index})`)

    letters.push({ char, text, rect, x: cursor, width })
    cursor += width + 2
  }
  const viewWidth = Math.max(300, cursor + 18)
  svg.setAttribute('viewBox', `0 0 ${viewWidth} 130`)

  const pen = svgEl('circle', {
    cx: letters[0]?.x || 18,
    cy: 92,
    r: 4.5,
    class: 'startup-pen'
  })
  if (config.showPen) svg.appendChild(pen)

  let introDone = false
  let finishRequested = false
  let exploded = false
  const speed = 1 / config.speed

  const timeline = createTimeline({
    defaults: { ease: 'inOutSine' },
    onComplete: () => {
      introDone = true
      if (finishRequested || options.preview) explode()
    }
  })

  timeline.add(overlay, { opacity: [0, 1], duration: 260 * speed }, 0)

  letters.forEach((letter, index) => {
    const start = (180 + index * 175) * speed
    timeline
      .add(letter.rect, { width: [0, letter.width + 4], duration: 300 * speed }, start)
      .add(letter.text, { opacity: [0, 1], duration: 220 * speed }, start)
      .add(letter.text, { translateY: [3, 0], rotate: [-2.5, 0], duration: 300 * speed }, start)
    if (config.showPen) {
      timeline.add(pen, {
        cx: letter.x + letter.width + 2,
        cy: 92,
        duration: 300 * speed
      }, start)
    }
  })

  const end = (180 + letters.length * 175 + 120) * speed
  if (config.showPen) {
    timeline.add(pen, { opacity: [1, 0], duration: 180 * speed }, end)
  }
  timeline.add(sub, { opacity: [0, 1], translateY: [4, 0], duration: 300 * speed }, end - 120 * speed)
  const introEnd = end + 240 * speed

  function explode() {
    if (exploded) return
    exploded = true

    const colors = particleColors(config)
    const layer = document.createElement('div')
    layer.className = 'startup-particles'
    document.body.appendChild(layer)

    const particles = []
    letters.forEach((letter, index) => {
      const rect = letter.text.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      for (let i = 0; i < config.particleCount; i += 1) {
        const particle = document.createElement('span')
        particle.className = `startup-particle is-${pickShape(config, index + i)}`
        particle.style.left = `${centerX}px`
        particle.style.top = `${centerY}px`
        particle.style.background = colors[(index + i) % colors.length]
        const size = utils.random(3, 7)
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
        layer.appendChild(particle)
        particles.push(particle)
      }

      animate(letter.text, {
        scale: config.effect === 'dissolve' ? [1, 0.85] : [1, 1.25],
        opacity: [1, 0],
        rotate: () => utils.random(-35, 35),
        duration: (config.effect === 'spark' ? 420 : 520) * speed,
        delay: index * 18 * speed,
        ease: 'outExpo'
      })
    })

    animate(particles, {
      x: () => utils.random(-260, 260),
      y: () => (config.effect === 'dissolve' ? utils.random(-220, -60) : utils.random(-190, 190)),
      scale: config.effect === 'spark' ? [1, 0.2] : [1, 0],
      opacity: [1, 0],
      rotate: () => utils.random(-220, 220),
      duration: () => utils.random(
        config.effect === 'spark' ? 550 : 650,
        config.effect === 'spark' ? 900 : 1150
      ) * speed,
      delay: stagger(6 * speed),
      ease: 'outExpo'
    })

    animate(sub, { opacity: [1, 0], duration: 220 * speed, ease: 'outQuad' })

    animate(overlay, {
      opacity: [1, 0],
      duration: 480 * speed,
      delay: 280 * speed,
      ease: 'outQuad',
      onComplete: () => {
        overlay.remove()
        layer.remove()
        delete window.__startupLoader
      }
    })
  }

  function finish() {
    if (finishRequested) return
    finishRequested = true
    if (introDone) explode()
  }

  if (options.preview) {
    const timer = window.setTimeout(() => explode(), introEnd + 350)
    window.__startupLoader = {
      preview: true,
      finish: () => {
        window.clearTimeout(timer)
        finish()
      }
    }
  } else {
    window.__startupLoader = { finish }
  }
}

/** 设置面板里的即时预览 */
export function previewStartupLoader(config) {
  startStartupLoader({ preview: true, config })
}
