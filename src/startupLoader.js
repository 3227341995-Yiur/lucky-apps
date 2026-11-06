/**
 * 启动加载动画：逐字手绘 loading + 每个字符爆炸成粒子
 * 在扩展资源加载完成前显示，main.js 挂载后调用 finish()。
 */
import { animate, createTimeline, stagger, utils } from 'animejs'

const STYLE_ID = 'startup-loader-style'
const SVG_NS = 'http://www.w3.org/2000/svg'

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
      width: min(430px, 78vw);
      overflow: visible;
    }

    .startup-word text {
      font-family: "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive;
      font-size: 76px;
      font-weight: 400;
      fill: var(--el-color-primary, #3574f0);
      stroke: var(--el-color-primary, #3574f0);
      stroke-width: 1.1;
      stroke-linejoin: round;
      paint-order: stroke fill;
      opacity: 0;
    }

    .startup-pen {
      fill: var(--el-color-primary, #3574f0);
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--el-color-primary, #3574f0) 55%, transparent));
    }

    .startup-sub {
      margin-top: 14px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--el-text-color-secondary, #909399);
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
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--el-color-primary, #3574f0);
      will-change: transform, opacity;
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

export function startStartupLoader() {
  if (typeof document === 'undefined' || window.__startupLoader) return
  ensureStyles()
  removePlaceholder()

  const overlay = document.createElement('div')
  overlay.className = 'startup-loader'
  overlay.innerHTML = `
    <svg class="startup-word" viewBox="0 0 430 130" aria-hidden="true">
      <defs></defs>
    </svg>
    <div class="startup-sub">正在加载资源</div>
  `
  document.body.appendChild(overlay)

  const svg = overlay.querySelector('.startup-word')
  const defs = svg.querySelector('defs')
  const sub = overlay.querySelector('.startup-sub')

  // 逐字排布，每个字符独立裁剪、独立绘制
  const letters = []
  let cursor = 18
  for (const [index, char] of [...'loading'].entries()) {
    const text = svgEl('text', { x: cursor, y: 92 })
    text.textContent = char
    svg.appendChild(text)

    const width = Math.max(1, text.getComputedTextLength())
    const clip = svgEl('clipPath', { id: `startup-clip-${index}` })
    const rect = svgEl('rect', {
      x: cursor - 2,
      y: 8,
      width: 0,
      height: 118
    })
    clip.appendChild(rect)
    defs.appendChild(clip)
    text.setAttribute('clip-path', `url(#startup-clip-${index})`)

    letters.push({ char, text, rect, x: cursor, width })
    cursor += width + 2
  }

  const pen = svgEl('circle', {
    cx: letters[0]?.x || 18,
    cy: 92,
    r: 4.5,
    class: 'startup-pen'
  })
  svg.appendChild(pen)

  let introDone = false
  let finishRequested = false
  let exploded = false

  const timeline = createTimeline({
    defaults: { ease: 'inOutSine' },
    onComplete: () => {
      introDone = true
      if (finishRequested) explode()
    }
  })

  timeline.add(overlay, { opacity: [0, 1], duration: 260 }, 0)

  letters.forEach((letter, index) => {
    const start = 180 + index * 175
    timeline
      .add(letter.rect, { width: [0, letter.width + 4], duration: 300 }, start)
      .add(letter.text, { opacity: [0, 1], duration: 220 }, start)
      .add(letter.text, { translateY: [3, 0], rotate: [-2.5, 0], duration: 300 }, start)
      .add(pen, {
        cx: letter.x + letter.width + 2,
        cy: 92,
        duration: 300
      }, start)
  })

  const end = 180 + letters.length * 175 + 120
  timeline
    .add(pen, { opacity: [1, 0], duration: 180 }, end)
    .add(sub, { opacity: [0, 1], translateY: [4, 0], duration: 300 }, end - 120)

  function explode() {
    if (exploded) return
    exploded = true

    const palette = ['#3574f0', '#36a3ff', '#67c23a', '#e6a23c', '#f56c6c', '#8b5cf6']
    const layer = document.createElement('div')
    layer.className = 'startup-particles'
    document.body.appendChild(layer)

    const particles = []
    letters.forEach((letter, index) => {
      const rect = letter.text.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      for (let i = 0; i < 8; i += 1) {
        const particle = document.createElement('span')
        particle.className = 'startup-particle'
        particle.style.left = `${centerX}px`
        particle.style.top = `${centerY}px`
        particle.style.background = palette[(index + i) % palette.length]
        const size = utils.random(3, 7)
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
        if (i % 3 === 0) particle.style.borderRadius = '2px'
        layer.appendChild(particle)
        particles.push(particle)
      }

      animate(letter.text, {
        scale: [1, 1.25],
        opacity: [1, 0],
        rotate: () => utils.random(-35, 35),
        duration: 520,
        delay: index * 18,
        ease: 'outExpo'
      })
    })

    animate(particles, {
      x: () => utils.random(-240, 240),
      y: () => utils.random(-180, 180),
      scale: [1, 0],
      opacity: [1, 0],
      rotate: () => utils.random(-220, 220),
      duration: () => utils.random(650, 1150),
      delay: stagger(6),
      ease: 'outExpo'
    })

    animate(sub, {
      opacity: [1, 0],
      duration: 220,
      ease: 'outQuad'
    })

    animate(overlay, {
      opacity: [1, 0],
      duration: 480,
      delay: 280,
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

  window.__startupLoader = { finish }
}
