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
      func(cumulativeOffsets.x, cumulativeOffsets.y)
      cumulativeOffsets.x = cumulativeOffsets.y = 0
    }, time)
  return function(dx, dy) {
    cumulativeOffsets.x += dx
    cumulativeOffsets.y += dy
    checkThrottled()
  }
}

const CTRL_WND_OPTS = {
  frame: false,
  transparent: true,
  show: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  acceptFirstMouse: true,
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

app.once('ready', _ => {
  win = new BrowserWindow(CTRL_WND_OPTS)
  win.loadURL(`file://${__dirname}/html/index.html`)
  win.webContents.openDevTools({ mode: 'detach' })

  hook.start()
  if (!hook.isOK()) {
    const packageJSON = require(path.join(__dirname, 'package.json')),
      configPath = path.join(app.getPath('home'), `${packageJSON.name}.json`),
      config = fs.existsSync(configPath) ? require(configPath) : { }
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

  hook.errorCount = 0
  setInterval(_ => {
    if (hook.isOK()) {
      hook.errorCount = 0
    }
    else if (++ hook.errorCount < 5) {
      hook.start()
    }
    else {
      console.log('sai seems closed. quit.')
      app.quit()
    }
  }, 1000)
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

hook.on('pen-status', (key, isDown) => {
  console.log(key, isDown)
})

hook.on('touch-down', (x, y, n) => {
  if (n != 2) {
    clearTimeout(hook.startManipulation)
    hook.manipulationStatus = null
  }
  else hook.startManipulation = setTimeout(_ => {
    const scale = hook.getSaiCanvasZoom(),
      angle = hook.getSaiCanvasRotation()
    hook.manipulationStatus = { scale, angle }
  }, 50)
})

hook.on('touch-up', (x, y, n) => {
  if (n != 2) {
    clearTimeout(hook.startManipulation)
    hook.manipulationStatus = null
  }
})

hook.on('touch-gesture', (x, y, s, r) => {
  if (hook.manipulationStatus) {
    const { scale, angle } = hook.manipulationStatus
    hook.setSaiCanvasZoom(s * scale)
    hook.setSaiCanvasRotation(r / Math.PI * 180 + angle)
  }
})

ipcMain.on('get-cursor-position', evt => {
  evt.returnValue = electron.screen.getCursorScreenPoint()
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

hook.setSaiCanvasZoom = throttled(hook.setSaiCanvasZoom.bind(hook), 30)
ipcMain.on('sai-canvas-zoom', (evt, scale) => {
  scale !== undefined ?
    hook.setSaiCanvasZoom(scale) :
    (evt.returnValue = hook.getSaiCanvasZoom())
})

hook.setSaiCanvasRotation = throttled(hook.setSaiCanvasRotation.bind(hook), 32)
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
