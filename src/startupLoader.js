/**
 * 启动加载动画：手绘描边 loading + 收尾粒子。
 * 配置保存在 localStorage，启动时同步读取，不依赖数据库。
 */
import { animate, createTimeline, stagger, utils } from 'animejs'

const STYLE_ID = 'startup-loader-style'
const STORAGE_KEY = 'wr:loading'
const SVG_NS = 'http://www.w3.org/2000/svg'

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
  fontSize: 72,
  color: '#3574f0',
  background: '',
  drawStyle: 'draw',
  effect: 'explode',
  particleCount: 36,
  particleShape: 'mixed',
  particleColors: '#3574f0,#36a3ff,#67c23a,#e6a23c,#f56c6c,#8b5cf6',
  showPen: true,
  speed: 1
}

function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_LOADING_CONFIG, ...raw }
  config.text = String(config.text || 'loading').slice(0, 40)
  config.subtitle = String(config.subtitle ?? '')
  config.fontSize = Math.min(160, Math.max(28, Number(config.fontSize) || 72))
  config.particleCount = Math.min(40, Math.max(0, Number(config.particleCount) || 0))
  config.speed = Math.min(2.5, Math.max(0.4, Number(config.speed) || 1))
  config.drawStyle = ['draw', 'typewriter', 'fade'].includes(config.drawStyle) ? config.drawStyle : 'draw'
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
      transition: background-color .2s ease;
    }

    html.dark .startup-loader {
      background: var(--el-bg-color-page, #141414);
    }

    .startup-word {
      display: block;
      width: min(720px, 86vw);
      overflow: visible;
    }

    .startup-word text {
      font-weight: 400;
      stroke-linecap: round;
      stroke-linejoin: round;
      paint-order: stroke fill;
      filter: drop-shadow(0 0 2px color-mix(in srgb, var(--startup-ink, #3574f0) 30%, transparent));
    }

    .startup-pen {
      fill: var(--startup-ink, #3574f0);
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--startup-ink, #3574f0) 70%, transparent));
    }

    .startup-sub {
      margin-top: 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--el-text-color-secondary, #909399);
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
      will-change: transform, opacity;
      box-shadow: 0 0 9px currentColor;
      opacity: 1;
    }

    .startup-particle.is-circle { border-radius: 50%; }
    .startup-particle.is-square { border-radius: 2px; }
    .startup-particle.is-star {
      clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%);
    }

    .startup-flash {
      position: fixed;
      width: 40vmin;
      height: 40vmin;
      margin: -20vmin 0 0 -20vmin;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--startup-ink, #3574f0) 34%, transparent) 0%, transparent 68%);
      pointer-events: none;
      opacity: 0;
      z-index: 100001;
    }

    .startup-ray {
      position: fixed;
      height: 2px;
      transform-origin: 0 50%;
      border-radius: 999px;
      background: linear-gradient(90deg, currentColor, transparent);
      opacity: 0;
      pointer-events: none;
      z-index: 100001;
    }

    .startup-shockwave {
      position: fixed;
      width: 18px;
      height: 18px;
      margin: -9px 0 0 -9px;
      border: 2px solid var(--startup-ink, #3574f0);
      border-radius: 50%;
      box-shadow: 0 0 18px color-mix(in srgb, var(--startup-ink, #3574f0) 65%, transparent);
      opacity: 0;
      pointer-events: none;
      z-index: 100001;
    }
  `
  document.head.appendChild(style)
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

function removePlaceholder() {
  document.getElementById('boot-placeholder')?.remove()
}

/**
 * 启动 / 预览加载动画。
 * @param {{preview?: boolean, config?: object}} options
 */
export function startStartupLoader(options = {}) {
  if (typeof document === 'undefined') return
  if (options.preview) {
    window.__startupLoader?.finish?.()
    document.querySelectorAll('.startup-loader, .startup-particles, .startup-shockwave').forEach(node => node.remove())
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

  const svg = svgEl('svg', { class: 'startup-word', viewBox: '0 0 720 170', 'aria-hidden': 'true' })
  const defs = svgEl('defs')
  svg.appendChild(defs)
  const sub = document.createElement('div')
  sub.className = 'startup-sub'
  sub.textContent = config.subtitle
  sub.style.color = config.color
  overlay.append(svg, sub)
  document.body.appendChild(overlay)

  const letters = []
  let cursor = 0
  for (const [index, char] of [...config.text].entries()) {
    const text = svgEl('text', {
      x: 0,
      y: 108,
      'font-family': config.font,
      'font-size': config.fontSize,
      fill: config.color,
      stroke: config.color,
      'stroke-width': 1.35,
      'fill-opacity': 0,
      'stroke-opacity': 1
    })
    text.textContent = char === ' ' ? ' ' : char
    svg.appendChild(text)
    const width = Math.max(2, text.getComputedTextLength())
    letters.push({ char, text, width, index })
    cursor += width + Math.max(2, config.fontSize * 0.04)
  }

  const totalWidth = Math.max(80, cursor)
  const viewWidth = Math.max(320, totalWidth + config.fontSize)
  svg.setAttribute('viewBox', `0 0 ${viewWidth} 170`)
  let x = (viewWidth - totalWidth) / 2
  letters.forEach(letter => {
    letter.x = x
    letter.text.setAttribute('x', x)
    x += letter.width + Math.max(2, config.fontSize * 0.04)
  })

  const pen = svgEl('circle', {
    cx: letters[0]?.x || 0,
    cy: 104,
    r: Math.max(2.5, config.fontSize * 0.06),
    class: 'startup-pen'
  })
  if (config.showPen) svg.appendChild(pen)

  let finishRequested = false
  let introDone = false
  let exploded = false
  const speed = 1 / config.speed
  const step = 150 * speed
  const introEnd = 120 + letters.length * step + 420 * speed

  const timeline = createTimeline({
    defaults: { ease: 'inOutSine' },
    onComplete: () => {
      introDone = true
      if (finishRequested || options.preview) explode()
    }
  })

  timeline.add(overlay, { opacity: [0, 1], duration: 260 * speed }, 0)

  letters.forEach((letter, index) => {
    const start = 120 + index * step
    if (config.drawStyle === 'draw') {
      const dash = Math.max(80, letter.width * 5 + config.fontSize * 2)
      letter.text.style.strokeDasharray = `${dash}`
      letter.text.style.strokeDashoffset = `${dash}`
      timeline
        .add(letter.text, { strokeDashoffset: [dash, 0], duration: 360 * speed }, start)
        .add(letter.text, { fillOpacity: [0, 1], duration: 220 * speed }, start + 220 * speed)
        .add(letter.text, { translateY: [2, 0], rotate: [-1.2, 0], duration: 300 * speed }, start)
    } else if (config.drawStyle === 'typewriter') {
      const clip = svgEl('clipPath', { id: `startup-clip-${index}` })
      const rect = svgEl('rect', { x: letter.x - 2, y: 10, width: 0, height: 150 })
      clip.appendChild(rect)
      defs.appendChild(clip)
      letter.text.setAttribute('clip-path', `url(#startup-clip-${index})`)
      timeline
        .add(rect, { width: [0, letter.width + 4], duration: 300 * speed }, start)
        .add(letter.text, { fillOpacity: [0, 1], duration: 180 * speed }, start)
    } else {
      timeline
        .add(letter.text, { opacity: [0, 1], translateY: [8, 0], duration: 320 * speed }, start)
        .add(letter.text, { fillOpacity: [0, 1], duration: 220 * speed }, start)
    }

    if (config.showPen) {
      timeline.add(pen, {
        cx: letter.x + letter.width + (index === letters.length - 1 ? 0 : 2),
        cy: 104,
        duration: 300 * speed
      }, start)
    }
  })

  timeline
    .add(pen, { opacity: [1, 0], duration: 160 * speed }, introEnd - 200 * speed)
    .add(sub, { opacity: [0, 1], translateY: [4, 0], duration: 300 * speed }, introEnd - 280 * speed)

  function explode() {
    if (exploded) return
    exploded = true

    const colors = particleColors(config)
    const layer = document.createElement('div')
    layer.className = 'startup-particles'
    document.body.appendChild(layer)
    const particles = []

    letters.forEach((letter, letterIndex) => {
      const rect = letter.text.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      for (let i = 0; i < config.particleCount; i += 1) {
        const particle = document.createElement('span')
        const shape = pickShape(config, letterIndex + i)
        particle.className = `startup-particle is-${shape}`
        particle.style.left = `${centerX}px`
        particle.style.top = `${centerY}px`
        particle.style.background = colors[(letterIndex + i) % colors.length]
        const size = utils.random(6, 16)
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
        particle.style.color = particle.style.background
        layer.appendChild(particle)
        particles.push(particle)
      }

      animate(letter.text, {
        scale: config.effect === 'dissolve' ? [1, 0.75] : [1, 1.32],
        opacity: [1, 0],
        rotate: () => utils.random(-30, 30),
        duration: (config.effect === 'spark' ? 380 : 560) * speed,
        delay: letterIndex * 16 * speed,
        ease: 'outExpo'
      })
    })

    const wordRect = svg.getBoundingClientRect()
    const center = {
      x: wordRect.left + wordRect.width / 2,
      y: wordRect.top + wordRect.height / 2
    }

    if (config.effect !== 'spark') {
      const flash = document.createElement('span')
      flash.className = 'startup-flash'
      flash.style.left = `${center.x}px`
      flash.style.top = `${center.y}px`
      layer.appendChild(flash)
      animate(flash, {
        scale: [0.2, 2.4],
        opacity: [0.8, 0],
        duration: 620 * speed,
        ease: 'outQuad'
      })

      // 中心补一层粒子，避免只按字符分布时中间空
      const burst = []
      for (let i = 0; i < 70; i += 1) {
        const particle = document.createElement('span')
        const shape = pickShape(config, i + 1)
        particle.className = `startup-particle is-${shape}`
        particle.style.left = `${center.x + utils.random(-18, 18)}px`
        particle.style.top = `${center.y + utils.random(-26, 26)}px`
        particle.style.background = colors[i % colors.length]
        const size = utils.random(3.5, 10)
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
        particle.style.color = particle.style.background
        layer.appendChild(particle)
        burst.push(particle)
      }
      animate(burst, {
        x: () => utils.random(-320, 320),
        y: () => (config.effect === 'dissolve' ? utils.random(-260, -80) : utils.random(-250, 250)),
        scale: [1, 0],
        rotate: () => utils.random(-300, 300),
        opacity: [1, 0],
        duration: () => utils.random(950, 1750) * speed,
        delay: stagger(2 * speed),
        ease: 'outExpo'
      })

      const rays = []
      for (let i = 0; i < 36; i += 1) {
        const ray = document.createElement('span')
        ray.className = 'startup-ray'
        const length = utils.random(44, 130)
        ray.style.left = `${center.x}px`
        ray.style.top = `${center.y}px`
        ray.style.width = `${length}px`
        ray.style.color = colors[i % colors.length]
        ray.style.background = `linear-gradient(90deg, ${colors[i % colors.length]}, transparent)`
        const angle = (360 / 36) * i + utils.random(-4, 4)
        ray.style.transform = `rotate(${angle}deg)`
        layer.appendChild(ray)
        rays.push({ ray, angle, length })
      }
      animate(rays.map(item => item.ray), {
        scaleX: [0.15, 1],
        opacity: [0.85, 0],
        rotate: (_, index) => rays[index].angle,
        duration: () => utils.random(650, 1100) * speed,
        delay: stagger(2 * speed),
        ease: 'outExpo'
      })

      for (let ring = 0; ring < 2; ring += 1) {
        const wave = document.createElement('span')
        wave.className = 'startup-shockwave'
        wave.style.left = `${center.x}px`
        wave.style.top = `${center.y}px`
        wave.style.borderColor = config.color
        layer.appendChild(wave)
        animate(wave, {
          scale: [0.35, ring ? 8 : 6],
          opacity: [ring ? 0.2 : 0.35, 0],
          duration: (ring ? 820 : 620) * speed,
          delay: ring * 140 * speed,
          ease: 'outQuad'
        })
      }
    }

    animate(particles, {
      x: () => utils.random(-300, 300),
      y: () => (
        config.effect === 'dissolve'
          ? utils.random(-260, -80)
          : utils.random(-240, 240)
      ),
      scale: config.effect === 'spark' ? [1, 0.15] : [1, 0],
      rotate: () => utils.random(-360, 360),
      opacity: [1, 0],
      duration: () => utils.random(
        config.effect === 'spark' ? 650 : 1300,
        config.effect === 'spark' ? 1100 : 2200
      ) * speed,
      delay: stagger(3 * speed),
      ease: 'outExpo'
    })

    animate(sub, { opacity: [1, 0], duration: 260 * speed, ease: 'outQuad' })

    animate(overlay, {
      opacity: [1, 0],
      duration: 520 * speed,
      delay: (config.effect === 'spark' ? 350 : 1100) * speed,
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
    const timer = window.setTimeout(() => explode(), introEnd + 300)
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
