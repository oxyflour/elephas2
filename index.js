const electron = require('electron'),
  fs = require('fs'),
  cp = require('child_process'),
  path = require('path'),
  hook = require('./build/Release/hook'),
  helper = require('./build/Release/helper'),
  { app, ipcMain, BrowserWindow, dialog } = electron

function throttled(func, time) {
  let timeout, args
  return function() {
    args = arguments
    if (!timeout) timeout = setTimeout(_ => {
      timeout = 0
      func.apply(null, args)
    }, time)
  }
}

function cumulativeThrottled(func, time) {
  const cumulativeOffsets = { x: 0, y: 0 },
    checkThrottled = throttled(_ => {
      if (cumulativeOffsets.x || cumulativeOffsets.y) {
        func(cumulativeOffsets.x, cumulativeOffsets.y)
        cumulativeOffsets.x = cumulativeOffsets.y = 0
      }
    }, time)
  return function(dx, dy) {
    cumulativeOffsets.x += dx
    cumulativeOffsets.y += dy
    checkThrottled()
  }
}

function simulateShortcut(shortcuts) {
  shortcuts.split(' ').filter(keys => keys).forEach(keys => {
    keys.split('+')
      .filter(key => key)
      .filter(key => helper.simulateKey(key,  true) || true)
      .reverse()
      .filter(key => helper.simulateKey(key, false) || true)
  })
}

const CTRL_WND_OPTS = {
  frame: false,
  transparent: true,
  show: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  acceptFirstMouse: true,
  resizable: false,
}

const ASK_START_SAI = {
  type: 'question',
  title: 'find sai2 failed',
  message: 'SAI2 seems not running. Would you like to start it?',
  buttons: ['OK', 'Cancel'],
}

const FIND_SAI_DIAG = {
  title: 'where is sai2.exe?',
  filters: [{ name: 'sai2.exe', extensions: ['exe'] }],
}

let win

const packageJSON = require(path.join(__dirname, 'package.json')),
  appConfigPath = path.join(__dirname, 'elephas2.json'),
  defaultConfig = require(appConfigPath),
  homeConfigPath = path.join(app.getPath('home'), `${packageJSON.name}.json`),
  configPath = fs.existsSync(homeConfigPath) ? homeConfigPath : appConfigPath,
  config = Object.assign(defaultConfig, require(configPath))

app.once('ready', _ => {
  const query = encodeURIComponent(JSON.stringify(config))
  win = new BrowserWindow(CTRL_WND_OPTS)
  win.loadURL(`file://${__dirname}/html/index.html?${query}`)
  if (config.showDevTools) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  hook.start()
  if (!hook.isHooked()) {
    if (!config.autoStart) {
      const askStartResult = dialog.showMessageBox(ASK_START_SAI)
      if (askStartResult !== 0) {
        return app.quit()
      }
    }
    if (!config.saiPath || !fs.existsSync(config.saiPath)) {
      const findSaiResult = dialog.showOpenDialog(FIND_SAI_DIAG)
      if (!findSaiResult || !(config.saiPath = findSaiResult[0]) || !fs.existsSync(config.saiPath)) {
        return app.quit()
      }
    }
    cp.spawn(config.saiPath, { detached: true }).unref()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }

  hook.retryTimeout = config.hookRetryTimeout
  setInterval(_ => {
    if (!hook.isActive()) {
      console.log('another instance is running. quit.')
      hook.destroy()
      app.quit()
    }
    else if (!hook.isHooked() && !(hook.retryTimeout > 0)) {
      console.log('unable to find sai window. quit.')
      app.quit()
    }
    else if (!hook.isHooked()) {
      hook.retryTimeout -= 500
      hook.start()
    }
    else {
      hook.retryTimeout = config.hookRetryTimeout
    }
  }, 500)
})

app.once('window-all-closed', _ => {
  app.quit()
})

hook.on('key-down', key => {
  win && win.webContents.send('hook-key-down', key)
})

hook.on('key-up', key => {
  win && win.webContents.send('hook-key-up', key)
})

hook.on('mouse-down', key => {
  win && win.webContents.send('hook-mouse-down', key)
})

hook.on('mouse-up', key => {
  win && win.webContents.send('hook-mouse-up', key)
})

hook.on('pen-button-down', key => {
  win && win.webContents.send('hook-pen-button-down', key)
})

hook.on('pen-button-up', key => {
  win && win.webContents.send('hook-pen-button-up', key)
})

const tapTicks = { }

hook.on('touch-down', (x, y, n) => {
  // taps
  if (n > 0) {
    tapTicks[n] = Date.now()
  }
  // zoom/rotate
  clearTimeout(hook.startManipulation)
  if (n != 2) {
    hook.manipulationStatus = null
  }
  else hook.startManipulation = setTimeout(_ => {
    const scale = hook.getSaiCanvasZoom(),
      angle = hook.getSaiCanvasRotation(),
      dx = 0, dy = 0
    hook.manipulationStatus = { scale, angle, dx, dy }
  }, 50)
})

hook.on('touch-up', (x, y, n) => {
  // check taps
  if (n == 0) {
    const now = Date.now()
    for (var i = 0; tapTicks[i + 1] > now - 200; i ++);
    const shortcuts = config.tapShortcuts && config.tapShortcuts[i - 1]
    if (shortcuts) {
      simulateShortcut(shortcuts)
    }
  }
  // zoom/rotate
  clearTimeout(hook.startManipulation)
  if (n != 2) {
    hook.manipulationStatus = null
  }
})

hook.moveCanvas = cumulativeThrottled(hook.moveCanvas.bind(hook), 30)
hook.on('touch-gesture', (x, y, s, r) => {
  if (hook.manipulationStatus) {
    const { scale, angle, dx, dy } = hook.manipulationStatus
    // FIXME: These seems no way to block default pinch-zoom behavior (CTRL+MOUSEWHEEL),
    //        so we make use of it
    //hook.setSaiCanvasZoom(s * scale)
    hook.setSaiCanvasRotation(Math.floor((r + angle) / 2) * 2)
    helper.simulateKey('CONTROL', false)
    hook.moveCanvas(x - dx, y - dy)
    hook.manipulationStatus.dx = x
    hook.manipulationStatus.dy = y
  }
})

ipcMain.on('get-cursor-position', evt => {
  evt.returnValue = electron.screen.getCursorScreenPoint()
})

ipcMain.on('save-config', (evt, key, val) => {
  config[key] = val
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
})

ipcMain.on('show-window', (evt, show) => {
  show ? win.show() : win.hide()
})

ipcMain.on('ignore-mouse', (evt, ignore) => {
  win.setIgnoreMouseEvents(!!ignore)
})

ipcMain.on('activate-sai-window', evt => {
  hook.activateSaiWindow()
})

ipcMain.on('simulate-key', (evt, key, isDown) => {
  helper.simulateKey(key, isDown)
})

hook.setSaiCanvasZoom = throttled(hook.setSaiCanvasZoom.bind(hook), 40)
ipcMain.on('sai-canvas-zoom', (evt, scale) => {
  scale !== undefined ?
    hook.setSaiCanvasZoom(scale) :
    (evt.returnValue = hook.getSaiCanvasZoom())
})

hook.setSaiCanvasRotation = throttled(hook.setSaiCanvasRotation.bind(hook), 40)
ipcMain.on('sai-canvas-rotation', (evt, angle) => {
  angle !== undefined ?
    hook.setSaiCanvasRotation(angle) :
    (evt.returnValue = hook.getSaiCanvasRotation())
})

hook.setSaiColorHSV = throttled(hook.setSaiColorHSV.bind(hook), 50)
ipcMain.on('sai-color-hsv', (evt, h, s, v) => {
  h !== undefined || s !== undefined || v !== undefined ?
    hook.setSaiColorHSV(h, s, v) :
    (evt.returnValue = hook.getSaiColorHSV())
})
