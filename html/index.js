const { ipcRenderer } = require('electron')

function attachDraggable(elem, start, move, finish, ignore) {
  if (Array.isArray(elem)) {
    return elem.forEach(elem => attachDraggable(elem, start, move, finish, ignore))
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
  }

  elem.addEventListener('mousedown', _start)
  return _ => elem.removeEventListener('mousedown', _start)
}

function attachAccessory(elem, keys, start, finish, ignore) {
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

void(function() {
  function showWindow() {
    document.body.classList.add('show')
    if (!window.isShown) {
      const { x, y } = ipcRenderer.sendSync('get-cursor-position')
      window.resizeTo(360, 360)
      window.moveTo(x - 360 / 2, y - 360 / 2)
      window.dispatchEvent(new Event('before-window-shown'))
      ipcRenderer.send('show-window', true)
      window.isShown = true
    }
  }

  function hideWindow() {
    document.body.classList.remove('show')
    document.body.addEventListener('webkitTransitionEnd', function once() {
      document.body.removeEventListener('webkitTransitionEnd', once)
      if (document.body.classList.contains('show')) {
        return
      }
      window.dispatchEvent(new Event('before-window-hidden'))
      ipcRenderer.send('show-window', false)
      ipcRenderer.send('activate-sai-window')
      window.dispatchEvent(new Event('after-window-hidden'))
      window.isShown = false
    })
  }

  let triggerKeyCode = 'Q'.charCodeAt(0),
    triggerKeyDown = false,
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
      hideWindow()
    }
  })

  window.addEventListener('keyup', evt => {
    if (evt.keyCode === triggerKeyCode &&
        triggerKeyDown && !(triggerKeyDown = false) &&
        !mouseLeftDown) {
      hideWindow()
    }
  })

  window.addEventListener('mousedown', evt => {
    if (!mouseLeftDown && (mouseLeftDown = true)) {
      // ...
    }
  })

  window.addEventListener('mouseup', evt => {
    if (mouseLeftDown && !(mouseLeftDown = false) &&
        !triggerKeyDown) {
      hideWindow()
    }
  })
})()

void(function() {
  const zoomStatus = document.getElementById('zoomStatus')

  function hideControl() {
    clearTimeout(hideControl.debounce)
    hideControl.debounce = setTimeout(_ => {
      document.body.classList.remove('is-manipulating', 'is-zooming', 'is-rotating')
    }, 500)
  }

  window.addEventListener('before-window-shown', evt => {
    clearTimeout(hideControl.debounce)
    document.body.classList.remove('is-manipulating', 'is-zooming', 'is-rotating')
  })

  attachDraggable(document.body, (evt, elem) => {
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
    hideControl()
  }, (evt, elem) => {
    return evt.target !== elem
  })

  attachDraggable(document.getElementById('moveControl'), (evt, elem) => {
    document.body.classList.add('is-moving')
    elem.start = ipcRenderer.sendSync('get-cursor-position')
    elem.base = { x: window.screenX, y: window.screenY }
  }, (evt, elem) => {
    const { x, y } = ipcRenderer.sendSync('get-cursor-position')
    window.moveTo(elem.base.x + x - elem.start.x, elem.base.y + y - elem.start.y)
  }, (evt, elem) => {
    document.body.classList.remove('is-moving')
  })

  attachAccessory(document.getElementById('moveLayer'), 'CONTROL')
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

function vec(fn) {
  return (v1, v2) => ({ x: fn(v1.x, v2.x), y: fn(v1.y, v2.y) })
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

void(function() {
  const pickerWidth = 180,
    ringWidth = 20,
    hw = pickerWidth / 2,
    pt = (r, a) => ra2xy(r, a, hw, hw)

  const r = hw - ringWidth / 2,
    ringStepCount = 6,
    ringStepPoints = range(ringStepCount).map(i => [
      pt(r, i     / ringStepCount * Math.PI*2),
      pt(r, (i+1) / ringStepCount * Math.PI*2),
    ])

  const d = r - ringWidth / 2,
    p1 = pt(d, 0),
    p2 = pt(d, 120 / 180 * Math.PI),
    p3 = pt(d, 240 / 180 * Math.PI)

  // http://stackoverflow.com/questions/18206361/svg-multiple-color-on-circle-stroke
  document.getElementById('colorPickerContainer').innerHTML =
  `<svg id="colorPicker" width="100%" height="100%" viewbox="0 0 ${pickerWidth} ${pickerWidth}">
    <defs>
    ${ringStepPoints.map(([p1, p2], i) =>
      `<linearGradient id="rainbow${i}" gradientUnits="userSpaceOnUse"
        x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}">
        <stop offset="0%"   stop-color="hsl(${p1.a * 180 / Math.PI}, 100%, 50%)" />
        <stop offset="100%" stop-color="hsl(${p2.a * 180 / Math.PI}, 100%, 50%)" />
      </linearGradient>`
    ).join('')}
    </defs>
    <g id="colorPickerRing" fill="none" stroke-width="${ringWidth}">
    ${ringStepPoints.map(([p1, p2], i) =>
      `<path
        d="M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}"
        stroke="url(#rainbow${i})" />`
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
        x="0" y="0" width="${pickerWidth}" height="${pickerWidth}" />
      <rect id="path1" fill="url(#fadeV)"
        x="0" y="0" width="${pickerWidth}" height="${pickerWidth}" />
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
      <rect id="colorPickerTriangle"
        clip-path="url(#clip)" filter="url(#blend)" width=${pickerWidth} height=${pickerWidth} />
      <circle id="colorPickerHueIndicator" cx="${hw + r}" cy="${hw}" r="5"
        fill="none" stroke="white" stroke-width="2" style="mix-blend-mode:exclusion" />
      <circle id="colorPickerSVIndicator"  cx="${hw + d}" cy="${hw}" r="3"
        fill="none" stroke="white" stroke-width="2" style="mix-blend-mode:exclusion" />
    </g>
  </svg>`

  const cpElem = document.getElementById('colorPicker'),
    cpHueIndicator = document.getElementById('colorPickerHueIndicator'),
    cpSVIndicator = document.getElementById('colorPickerSVIndicator'),
    cpRotation = document.getElementById('colorPickerRotation'),
    cpTriangle = document.getElementById('colorPickerTriangle'),
    cpHueRing = document.getElementById('colorPickerRing'),
    cpColor = document.getElementById('colorPickerColor'),

    matrixValues = [
      x => ` 1 0 0 0 0 ${x} 0 0 0 0 0 0 0 0 0 0 0 0 0 1`,
      x => ` ${x} 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1`,
      x => ` 0 0 0 0 0 1 0 0 0 0 ${x} 0 0 0 0 0 0 0 0 1`,
      x => ` 0 0 0 0 0 ${x} 0 0 0 0 1 0 0 0 0 0 0 0 0 1`,
      x => ` ${x} 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 1`,
      x => ` 1 0 0 0 0 0 0 0 0 0 ${x} 0 0 0 0 0 0 0 0 1`,
    ],
    filterMatrix = document.getElementById('layerRGB')

  let currentHSV = { h: 0, s: 1, v: 1 }

  function setHSV(h, s, v) {
    while (h < 0) h += 360
    while (h >= 360) h -= 360

    const match = /rotate\(([-\d\.]+)deg\)/.exec(cpRotation.style.transform),
      rotation = nearestAngle(match && parseFloat(match[1]) || 0, h)
    cpRotation.style.transform = `rotate(${rotation}deg)`

    const index = Math.floor(h / 60),
      extra = 1 - Math.abs(h / 60 % 2 - 1)
    layerRGB.setAttribute('values', matrixValues[index](extra))

    const { x, y } = getXYFromSV(s, v)
    cpSVIndicator.setAttribute('cx', x)
    cpSVIndicator.setAttribute('cy', y)

    const c = hsv2hsl(h, s, v)
    cpColor.style.background = `hsl(${c.h}, ${c.s * 100}%, ${c.l * 100}%)`

    currentHSV = { h, s, v }
    ipcRenderer.send('sai-color-hsv', h, s, v)
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
    const rect = cpElem.getBoundingClientRect(),
      c = { x: (rect.left + rect.right) / 2, y : (rect.top + rect.bottom) / 2 },
      v = { x: x - c.x, y: y - c.y },
      r = hypot(v.x, v.y),
      a = Math.atan2(v.y, v.x)
    return pt(r * pickerWidth / rect.width, a - currentHSV.h / 180 * Math.PI)
  }

  function setSVFromPoint(px, py) {
    const { x, y } = mapXYtoLocal(px, py),
      { s, v } = getSVFromXY(x, y)
    setHSV(currentHSV.h, s, v)
  }

  function setHueFromPoint(px, py) {
    const { a } = mapXYtoLocal(px, py),
      h = a * 180 / Math.PI + currentHSV.h
    setHSV(h, currentHSV.s, currentHSV.v)
  }

  attachDraggable([cpHueRing, cpHueIndicator], (evt, elem) => {
    setHueFromPoint(evt.pageX, evt.pageY)
  }, (evt, elem) => {
    setHueFromPoint(evt.pageX, evt.pageY)
  })

  attachDraggable([cpTriangle, cpSVIndicator], (evt, elem) => {
    setSVFromPoint(evt.pageX, evt.pageY)
  }, (evt, elem) => {
    setSVFromPoint(evt.pageX, evt.pageY)
  })

  attachAccessory(cpElem, 'SPACE', null, null, (evt, elem) => evt.target !== elem)

  window.addEventListener('before-window-shown', evt => {
    const { h, s, v } = ipcRenderer.sendSync('sai-color-hsv')
    setHSV(h, s, v)
  })
})()

window.addEventListener('before-window-shown', evt => {
  const floatButtons = document.querySelectorAll('.main .float-button'),
    radius = document.getElementById('colorPicker').getBoundingClientRect().width / 2
  ;[].forEach.call(floatButtons, (elem, index) => {
    const angle = -index / floatButtons.length * 360
    elem.style.transform =
      `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px, 0)`
  })
})
