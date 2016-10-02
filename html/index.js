const { ipcRenderer } = require('electron'),
  config = JSON.parse(decodeURIComponent(location.search.substr(1))),
  contentSize = Math.min(config.width, config.height) - config.floatButtonSize * 2

function attachDraggable(elem, start, move, finish, ignore) {
  if (elem.length >= 0) {
    return [].forEach.call(elem,
      elem => attachDraggable(elem, start, move, finish, ignore))
  }

  function _start(evt) {
    if (ignore && ignore(evt, elem)) {
      return
    }

    start && start(evt, elem)
    window.removeEventListener('mousemove', _move)
    window.addEventListener('mousemove', _move)
    window.removeEventListener('mouseup', _finish)
    window.addEventListener('mouseup', _finish)
  }

  function _move(evt) {
    move && move(evt, elem)
  }

  function _finish(evt) {
    finish && finish(evt, elem)
    window.removeEventListener('mousemove', _move)
    window.removeEventListener('mouseup', _finish)
  }

  elem.addEventListener('mousedown', _start)
  return _ => elem.removeEventListener('mousedown', _start)
}

function attachAccessory(elem, keys, start, finish, ignore) {
  if (elem.length >= 0) {
    return [].forEach.call(elem,
      elem => attachAccessory(elem, keys, start, finish, ignore))
  }

  function _start(evt) {
    if (ignore && ignore(evt, elem)) {
      return
    }

    ipcRenderer.send('simulate-key', 'LEFT', false)

    ipcRenderer.send('ignore-mouse', true)
    ipcRenderer.send('activate-sai-window')

    keys = Array.isArray(keys) ? keys : keys.split(' ').filter(key => key)
    keys.forEach(key => ipcRenderer.send('simulate-key', key, true))

    elem.start = ipcRenderer.sendSync('get-cursor-position')
    elem.base = { x: window.screenX, y: window.screenY }
    document.body.classList.add('is-transparent')

    start && start(evt, elem)

    ipcRenderer.send('simulate-key', 'LEFT', true)
    ipcRenderer.once('hook-mouse-up', _ => {
      keys.reverse().forEach(key => ipcRenderer.send('simulate-key', key, false))

      const { x, y } = ipcRenderer.sendSync('get-cursor-position')
      window.moveTo(elem.base.x + x - elem.start.x, elem.base.y + y - elem.start.y)
      document.body.classList.remove('is-transparent')

      finish && finish(null, elem)

      ipcRenderer.send('ignore-mouse', false)
    })
  }

  elem.addEventListener('mousedown', _start)
  return _ => elem.removeEventListener('mousedown', _start)
}

function simulateShorcut(keys) {
  ipcRenderer.send('activate-sai-window')
  keys && keys.split(' ').filter(keys => keys).forEach(keys => {
    keys.split('+').filter(key => key)
      .filter(key => ipcRenderer.send('simulate-key', key, true) || true)
      .reverse()
      .filter(key => ipcRenderer.send('simulate-key', key, false) || true)
  })
}

function elemFromString(string) {
  const tpl = document.createElement('template')
  tpl.innerHTML = string
  return tpl.content.firstChild
}

function getElementCenter(elem) {
  const rect = elem.getBoundingClientRect()
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
}

;[].forEach.call(document.querySelectorAll('body > .content.auto-size'), elem => {
  elem.style.width = elem.style.height = `${contentSize}px`
})

void(function() {
  function showWindow() {
    document.body.classList.add('show')
    window.dispatchEvent(new Event('before-window-shown'))
    if (!window.isShown) {
      const { x, y } = ipcRenderer.sendSync('get-cursor-position')
      window.resizeTo(config.width, config.height)
      window.moveTo(x - config.width / 2, y - config.height / 2)
      ipcRenderer.send('show-window', true)
      window.isShown = true
    }
    window.dispatchEvent(new Event('after-window-shown'))
  }

  function hideWindow() {
    document.body.classList.remove('show')
    window.dispatchEvent(new Event('before-window-hidden'))
    document.body.addEventListener('webkitTransitionEnd', function once() {
      if (!document.body.classList.contains('show')) {
        document.body.removeEventListener('webkitTransitionEnd', once)
        ipcRenderer.send('show-window', false)
        ipcRenderer.send('activate-sai-window')
        window.isShown = false
        window.dispatchEvent(new Event('after-window-hidden'))
      }
    })
  }

  let triggerKeyCode = config.triggerKeyChar.charCodeAt(0),
    triggerKeyDown = false,
    triggerPenButton = config.triggerPenButton,
    triggerButtonDown = false,
    mouseLeftDown = false

  ipcRenderer.on('hook-key-down', (evt, key) => {
    if (key === triggerKeyCode &&
        !triggerKeyDown && (triggerKeyDown = true)) {
      showWindow()
    }
  })

  ipcRenderer.on('hook-key-up', (evt, key) => {
    if (key === triggerKeyCode &&
        triggerKeyDown && !(triggerKeyDown = false)) {
      !triggerButtonDown && !mouseLeftDown && hideWindow()
    }
  })

  ipcRenderer.on('hook-pen-button-down', (evt, key) => {
    if (key === triggerPenButton &&
        !triggerButtonDown && (triggerButtonDown = true)) {
      showWindow()
    }
  })

  ipcRenderer.on('hook-pen-button-up', (evt, key) => {
    if (key === triggerPenButton &&
        triggerButtonDown && !(triggerButtonDown = false)) {
      !triggerKeyDown && !mouseLeftDown && hideWindow()
    }
  })

  window.addEventListener('keyup', evt => {
    if (evt.keyCode === triggerKeyCode &&
        triggerKeyDown && !(triggerKeyDown = false)) {
      !triggerButtonDown && !mouseLeftDown && hideWindow()
    }
  })

  window.addEventListener('mousedown', evt => {
    if (!mouseLeftDown && (mouseLeftDown = true)) {
      // ...
    }
  })

  window.addEventListener('mouseup', evt => {
    if (mouseLeftDown && !(mouseLeftDown = false)) {
      !triggerKeyDown && !triggerButtonDown && hideWindow()
    }
  })

  window.addEventListener('request-hide-window', evt => {
    hideWindow()
  })
})()

void(function() {
  let showChildTimeout

  const floatButtons = (config.floatButtons || [ ]).map((data, index) => {
    const elem = elemFromString(
      data.usage === 'color-history' ?
      `<span index="${index}" title="${data.title || ''}"
          class="float-button color-picker-color color-picker-history-selector">
        <i class="color-picker-color-bg"></i>
      </span>` :
      `<span index="${index}" title="${data.title || ''}"
          class="float-button"
          shortcut-keys="${data.key || ''}"
          app-cmd="${data.cmd || ''}"
          keep-open="${data.keepOpen || ''}">
        <i class="${data.cls || ''}"></i>
      </span>`)
    elem.style.width = elem.style.height =
      elem.style.lineHeight = `${config.floatButtonSize}px`
    main.appendChild(elem)
    return elem
  })

  function initFloatChild(index) {
    const q = document.querySelectorAll('.float-button-child-item'),
      children = config.floatButtons[index].children || [ ]
      iconFont = document.createElement('div')
    iconFont.style.display = 'none'
    document.body.appendChild(iconFont)
    ;[].forEach.call(q, (elem, i) => {
      const offset = index > q.length / 2 ? i + index : q.length * 2 - (i + index),
        data = children[offset % q.length] || { }
      elem.setAttribute('shortcut-keys', data.key || '')
      elem.setAttribute('app-cmd', data.cmd || '')
      elem.setAttribute('keep-open', data.keepOpen || '')
      elem.title = data.title || ''
      iconFont.className = data.cls
      const style = getComputedStyle(iconFont, ':before')
      elem.style.fontFamily = style.fontFamily
      elem.innerHTML = style.content.substr(1, 1)
    })
    document.body.removeChild(iconFont)
  }

  function setActiveFloatChild(x, y) {
    const q = document.querySelectorAll('.float-button-child-item'),
      w = (config.historyRingSize + config.colorRingSize) / 2,
      c = [].map.call(q, e => getElementCenter(e)),
      e = [].find.call(q, (e, i) => x >= c[i].x-w && x <= c[i].x+w && y >= c[i].y-w && y <= c[i].y+w)
    ;[].forEach.call(q, e => e.classList.remove('active'))
    e && e.classList.add('active')
  }

  const statusElem = document.getElementById('status')
  attachDraggable(floatButtons, (evt, elem) => {
    clearTimeout(showChildTimeout)
    showChildTimeout = setTimeout(_ => {
      document.body.classList.add('show-float-child')
    }, 200)
    initFloatChild(parseInt(elem.getAttribute('index')))
    setActiveFloatChild(evt.pageX, evt.pageY)
    statusElem.innerHTML = elem.title || ''
  }, (evt, elem) => {
    setActiveFloatChild(evt.pageX, evt.pageY)
    statusElem.innerHTML = (document.querySelector('.float-button-child-item.active') || { }).title || ''
  }, (evt, elem) => {
    const target = document.body.classList.contains('show-float-child') ?
      document.querySelector('.float-button-child-item.active') : elem
    if (target) {
      simulateShorcut(target.getAttribute('shortcut-keys'))
      target.getAttribute('keep-open') || window.dispatchEvent(new Event('request-hide-window'))
      target.getAttribute('app-cmd') && ipcRenderer.send(target.getAttribute('app-cmd'))
    }
    clearTimeout(showChildTimeout)
    showChildTimeout = setTimeout(_ => document.body.classList.remove('show-float-child'), 100)
    statusElem.innerHTML = ''
  }, (evt, elem) => {
    return elem.classList.contains('color-picker-history-selector')
  })

  function updateFloatButtons(offset) {
    const radius = (contentSize + config.floatButtonSize) / 2 + offset
    floatButtons.forEach((elem, index) => {
      const pos = ra2xy(radius, - index / floatButtons.length * 2 * Math.PI)
      elem.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`
    })
  }

  window.addEventListener('before-window-shown',  _ => updateFloatButtons(0))
  window.addEventListener('before-window-hidden', _ => updateFloatButtons(-15))
})()

void(function() {
  const zoomStatus = document.getElementById('zoomStatus')

  let hideDebounce
  window.addEventListener('before-window-shown', evt => {
    clearTimeout(hideDebounce)
    document.body.classList.remove('is-manipulating', 'is-zooming', 'is-rotating')
  })

  attachDraggable(document.querySelectorAll('.canvas-zoom-rotate'), (evt, elem) => {
    const { x, y } = ipcRenderer.sendSync('get-cursor-position')
    elem.mode = ''
    elem.scale = ipcRenderer.sendSync('sai-canvas-zoom')
    elem.angle = ipcRenderer.sendSync('sai-canvas-rotation')
    elem.v0 = { x: window.screenX + window.innerWidth / 2, y: window.screenY + window.innerHeight / 2}
    elem.v1 = { x: x - elem.v0.x, y: y - elem.v0.y }
    document.body.classList.add('is-manipulating')
    zoomStatus.innerHTML = `${elem.scale.toFixed(1)}% ${elem.angle.toFixed(1)}deg`
  }, (evt, elem) => {
    const { x, y } = ipcRenderer.sendSync('get-cursor-position'),
      { scale, angle, v0, v1 } = elem,
      v2 = { x: x - v0.x, y: y - v0.y },
      newScale = Math.max((v1.x*v2.x + v1.y*v2.y) / (v1.x*v1.x + v1.y*v1.y) * scale, 1 / 0x10000),
      newAngle = (Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x)) * 180 / Math.PI + angle

    if (elem.mode === 'is-zooming') {
      ipcRenderer.send('sai-canvas-zoom', newScale)
      zoomStatus.innerHTML = `${newScale.toFixed(1)}%`
    }
    else if (elem.mode === 'is-rotating') {
      ipcRenderer.send('sai-canvas-rotation', newAngle)
      zoomStatus.innerHTML = `${newAngle.toFixed(1)}deg`
    }
    else if (Math.abs(newScale - scale) / scale > 0.1) {
      elem.mode = 'is-zooming'
      document.body.classList.add(elem.mode)
    }
    else if (Math.abs(newAngle - angle) > 0.01 * 360) {
      elem.mode = 'is-rotating'
      document.body.classList.add(elem.mode)
    }
  }, (evt, elem) => {
    clearTimeout(hideDebounce)
    hideDebounce = setTimeout(_ => {
      document.body.classList.remove('is-manipulating', 'is-zooming', 'is-rotating')
    }, 300)
  })

  attachDraggable(document.querySelectorAll('.control-move'), (evt, elem) => {
    document.body.classList.add('is-moving')
    elem.start = ipcRenderer.sendSync('get-cursor-position')
    elem.base = { x: window.screenX, y: window.screenY }
  }, (evt, elem) => {
    const { x, y } = ipcRenderer.sendSync('get-cursor-position')
    window.moveTo(elem.base.x + x - elem.start.x, elem.base.y + y - elem.start.y)
  }, (evt, elem) => {
    document.body.classList.remove('is-moving')
  })

  ;[].forEach.call(document.querySelectorAll('.canvas-flip-h'), elem => {
    elem.addEventListener('click', evt => {
      simulateShorcut('H')
    })
  })

  attachAccessory(document.querySelectorAll('.layer-move'), 'CONTROL')
})()

function range(n) {
  return Array(n).fill(0).map((_, i) => i)
}

function clamp(v) {
  return Math.max(0, Math.min(1, v))
}

function hypot(x, y) {
  return Math.sqrt(x * x + y * y)
}

function ra2xy(r, a, x, y) {
  return {
    r,
    a,
    x: (x || 0) + r * Math.cos(a),
    y: (y || 0) + r * Math.sin(a),
  }
}

// https://gist.github.com/xpansive/1337890
function hsv2hsl(h, q, v) {
  const c = v * q,
    m = v - c,
    l = (v + m) / 2,
    s = l == 0 || l == 1 ? 0 : c / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

function nearestAngle(current, target) {
  while (current - target > 180) target += 360
  while (target - current > 180) target -= 360
  return target
}

function nearestRad(current, target) {
  return nearestAngle(current * 180 / Math.PI, target * 180 / Math.PI) * Math.PI / 180
}

void(function() {
  const hw = contentSize / 2,
    pt = (r, a) => ra2xy(r, a, hw, hw),
    ln = (r, n, a) => range(n).map(i => [
      pt(r, (i + a)     / n * Math.PI*2),
      pt(r, (i + a + 1) / n * Math.PI*2),
      r
    ])

  const historyRingSize = config.historyRingSize,
    historyRadius = hw - historyRingSize / 2,
    historyStepPoints = ln(historyRadius, config.historyColorCount, -0.5)

  const colorRingSize = config.colorRingSize,
    ringRadius = hw - historyRingSize - colorRingSize / 2,
    ringStepPoints = ln(ringRadius, 6, 0)

  const floatChildSize = historyRingSize * 2 + colorRingSize,
    floatRadius = hw - floatChildSize / 2,
    floatChildPoints = ln(floatRadius, config.floatButtons.length, 0)

  const pickerRadius = hw - historyRingSize - colorRingSize,
    p1 = pt(pickerRadius, 0),
    p2 = pt(pickerRadius, 120 / 180 * Math.PI),
    p3 = pt(pickerRadius, 240 / 180 * Math.PI)

  // http://stackoverflow.com/questions/18206361/svg-multiple-color-on-circle-stroke
  document.getElementById('main').appendChild(elemFromString(
  `<svg id="colorPicker" width="100%" height="100%" viewbox="0 0 ${contentSize} ${contentSize}">
    <defs>
    ${ringStepPoints.map(([p1, p2], i) =>
      `<linearGradient id="rainbow${i}" gradientUnits="userSpaceOnUse"
          x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}">
        <stop offset="0%"   stop-color="hsl(${p1.a * 180 / Math.PI}, 100%, 50%)" />
        <stop offset="100%" stop-color="hsl(${p2.a * 180 / Math.PI}, 100%, 50%)" />
      </linearGradient>`
    ).join('')}
    </defs>
    <g class="float-button-child" fill="none">
      <circle cx="${hw}" cy="${hw}" r="${floatRadius}"
        stroke="hsl(0, 0%, 90%)" stroke-width="${floatChildSize}" />
    ${floatChildPoints.map(([p1, p2, r], i) =>
      `<text class="float-button-child-item" x=${p1.x} y=${p1.y} fill="black"
        text-anchor="middle" alignment-baseline="central"></text>`
    ).join('')}
    </g>
    <g class="color-picker-hue" fill="none" stroke-width="${colorRingSize}">
    ${ringStepPoints.map(([p1, p2, r], i) =>
      `<path d="M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}"
          stroke="url(#rainbow${i})" />`
    ).join('')}
    </g>
    <g class="color-picker-history" fill="none" stroke-width="${historyRingSize}">
    ${historyStepPoints.map(([p1, p2, r], i) =>
      `<path d="M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}"
          class="color-picker-history-hsv" />`
    ).join('')}
    </g>
    <defs>
      <linearGradient id="fadeS" gradientUnits="userSpaceOnUse"
        x1="${p3.x}" y1="${p3.y}" x2="${p1.x}" y2="${p1.y}">
        <stop offset="0%"   stop-color="#000000" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
      <linearGradient id="fadeV" gradientUnits="userSpaceOnUse"
        x1="${p2.x}" y1="${p2.y}" x2="${(p1.x + p3.x) / 2}" y2="${(p1.y + p3.y) / 2}">
        <stop offset="0%"   stop-color="#000000" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
      <rect id="path0" fill="url(#fadeS)"
        x="0" y="0" width="${contentSize}" height="${contentSize}" />
      <rect id="path1" fill="url(#fadeV)"
        x="0" y="0" width="${contentSize}" height="${contentSize}" />
      <filter id="blend">
        <feImage xlink:href="#path0" result="layerS" x="0" y="0" />
        <feImage xlink:href="#path1" result="layerV" x="0" y="0" />
        <feComposite in="layerS" in2="layerV" color-interpolation-filters="sRGB"
          operator="arithmetic" k1="1" k2="0.0" k3="0.0" k4="0" result="layerC" />
        <feComposite in="layerV" in2="layerC" color-interpolation-filters="sRGB"
          operator="arithmetic" k1="0" k2="1.0" k3="-1.0" k4="0" result="layerM" />
        <feColorMatrix id="layerRGB" type="matrix" in="layerC" result="layerRGB" />
        <feComposite in="layerRGB" in2="layerM" color-interpolation-filters="sRGB"
          operator="arithmetic" k1="0" k2="1.0" k3="1.0" k4="0" />
      </filter>
      <clipPath id="clip">
        <path d="M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} ${p3.x} ${p3.y} Z" />
      </clipPath>
    </defs>
    <g id="colorPickerRotation" style="transform-origin:${hw}px ${hw}px">
      <rect class="color-picker-sv"
        clip-path="url(#clip)" filter="url(#blend)" width=${contentSize} height=${contentSize} />
      <circle class="color-picker-hue"
        cx="${hw + ringRadius}" cy="${hw}" r="5"
        fill="none" stroke="white" stroke-width="2" style="mix-blend-mode:exclusion" />
      <circle id="colorPickerSVIndicator" class="color-picker-sv"
        cx="${hw + pickerRadius}" cy="${hw}" r="3"
        fill="none" stroke="white" stroke-width="2" style="mix-blend-mode:exclusion" />
    </g>
  </svg>`))

  const cpElem = document.getElementById('colorPicker'),
    cpSVIndicator = document.getElementById('colorPickerSVIndicator'),
    cpRotation = document.getElementById('colorPickerRotation'),
    filterMatrix = document.getElementById('layerRGB'),
    matrixValues = [
      x => ` 1 0 0 0 0 ${x} 0 0 0 0 0 0 0 0 0 0 0 0 0 1`,
      x => ` ${x} 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1`,
      x => ` 0 0 0 0 0 1 0 0 0 0 ${x} 0 0 0 0 0 0 0 0 1`,
      x => ` 0 0 0 0 0 ${x} 0 0 0 0 1 0 0 0 0 0 0 0 0 1`,
      x => ` ${x} 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 1`,
      x => ` 1 0 0 0 0 0 0 0 0 0 ${x} 0 0 0 0 0 0 0 0 1`,
    ]

  let currentHSV = { h: 0, s: 1, v: 1 }
  function setHSV(h, s, v) {
    while (h < 0) h += 360
    while (h >= 360) h -= 360

    const match = /rotate\(([-\d\.]+)deg\)/.exec(cpRotation.style.transform),
      rotation = nearestAngle(match && parseFloat(match[1]) || 0, h)
    cpRotation.style.transform = `rotate(${rotation}deg)`

    const index = Math.floor(h / 60),
      extra = 1 - Math.abs(h / 60 % 2 - 1)
    filterMatrix.setAttribute('values', matrixValues[index](extra))

    const { x, y } = getXYFromSV(s, v)
    cpSVIndicator.setAttribute('cx', x)
    cpSVIndicator.setAttribute('cy', y)

    const c = hsv2hsl(h, s, v)
    ;[].forEach.call(document.querySelectorAll('.color-picker-color'), elem => {
      elem.style.background = `hsl(${c.h}, ${c.s * 100}%, ${c.l * 100}%)`
    })

    currentHSV = { h, s, v }
  }

  function getSVFromXY(x, y) {
    const
      v1 = { x: p1.x - p2.x, y: p1.y - p2.y },
      v2 = { x:    x - p2.x, y:    y - p2.y },
      a = Math.atan2(v1.y, v1.x) - Math.atan2(v2.y, v2.x),
      s = clamp(Math.sin(Math.PI/3 - a) / Math.sin(Math.PI/3 + a)),
      m = hypot(v1.x, v1.y) / Math.sin(Math.PI/3 + a) * Math.sin(Math.PI/3),
      v = clamp(hypot(v2.x, v2.y) / m)
    return { s, v }
  }

  function getXYFromSV(s, v) {
    const
      d1 = { x: p3.x + (p1.x - p3.x) * s, y: p3.y + (p1.y - p3.y) * s },
      d2 = { x: p2.x + (d1.x - p2.x) * v, y: p2.y + (d1.y - p2.y) * v }
    return d2
  }

  function mapXYtoLocal(x, y) {
    const c = getElementCenter(cpElem),
      r = hypot(y - c.y, x - c.x),
      a = Math.atan2(y - c.y, x - c.x)
    return pt(r, a - currentHSV.h / 180 * Math.PI)
  }

  function setSVFromPoint(px, py) {
    const { x, y } = mapXYtoLocal(px, py),
      { s, v } = getSVFromXY(x, y),
      { h } = currentHSV
    setHSV(h, s, v)
    ipcRenderer.send('sai-color-hsv', h, s, v)
  }

  function setHueFromPoint(px, py) {
    const { a } = mapXYtoLocal(px, py),
      h = (a * 180 / Math.PI + currentHSV.h + 360) % 360,
      { s, v } = currentHSV
    setHSV(h, s, v)
    ipcRenderer.send('sai-color-hsv', h, s, v)
  }

  let colorHistory = ['0,0,0.95']
  function addColorHistory(h, s, v) {
    colorHistory = [`${h},${s},${v}`].concat(colorHistory)
    colorHistory = Array.from(new Set(colorHistory)).slice(0, config.historyColorCount)
    const colorHSL = colorHistory
      .map(hsv => hsv2hsl.apply(null, hsv.split(',').map(parseFloat)))
      .map(hsl => `hsl(${hsl.h}, ${hsl.s * 100}%, ${hsl.l * 100}%)`)
    ;[].forEach.call(document.querySelectorAll('.color-picker-history-hsv'), (elem, index) => {
      elem.setAttribute('color-hsv', colorHistory[index] || colorHistory[colorHistory.length - 1])
      elem.setAttribute('stroke', colorHSL[index] || colorHSL[colorHSL.length - 1])
    })
    ;[].forEach.call(document.querySelectorAll('.color-picker-color-bg'), elem => {
      elem.style.background = colorHSL[0]
    })
  }

  function setColorFromHistoryPoint(x, y) {
    const c = getElementCenter(cpElem),
      a = Math.atan2(y - c.y, x - c.x),
      q = document.querySelectorAll('.color-picker-history-hsv'),
      p = historyStepPoints.map(([p1, p2]) => ({ a1: p1.a, a2: p2.a })),
      e = [].find.call(q, (e, i) => nearestRad(a, p[i].a1) <= a && a <= nearestRad(a, p[i].a2)),
      [h, s, v] = (e || q[q.length - 1]).getAttribute('color-hsv').split(',').map(parseFloat)

    ;[].forEach.call(q, e => e.classList.remove('active'))
    e.classList.add('active')

    setHSV(h, s, v)
    ipcRenderer.send('sai-color-hsv', h, s, v)
  }

  attachDraggable(document.querySelectorAll('.color-picker-hue'), (evt, elem) => {
    setHueFromPoint(evt.pageX, evt.pageY)
  }, (evt, elem) => {
    setHueFromPoint(evt.pageX, evt.pageY)
  })

  attachDraggable(document.querySelectorAll('.color-picker-sv'), (evt, elem) => {
    setSVFromPoint(evt.pageX, evt.pageY)
  }, (evt, elem) => {
    setSVFromPoint(evt.pageX, evt.pageY)
  })

  attachDraggable(document.querySelectorAll('.color-picker-history-selector'), (evt, elem) => {
    document.body.classList.add('show-color-history')
    setColorFromHistoryPoint(evt.pageX, evt.pageY)
  }, (evt, elem) => {
    setColorFromHistoryPoint(evt.pageX, evt.pageY)
  }, (evt, elem) => {
    document.body.classList.remove('show-color-history')
  })

  attachAccessory(cpElem, 'SPACE', null, null, (evt, elem) => evt.target !== elem)

  window.addEventListener('before-window-shown', evt => {
    const { h, s, v } = ipcRenderer.sendSync('sai-color-hsv')
    setHSV(h, s, v)
    addColorHistory(h, s, v)
  })
})()
