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

function accumThrottled(func, time) {
  const accuDelta = { x: 0, y: 0 }
  const moveXY = throttled(() => {
    if (accuDelta.x || accuDelta.y) {
      func.call(null, accuDelta.x, accuDelta.y)
      accuDelta.x = accuDelta.y = 0
    }
  }, time)
  return (dx, dy) => {
    accuDelta.x += dx
    accuDelta.y += dy
    moveXY()
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
  buttons: ['OK', 'OK and Remember', 'Cancel'],
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
      if (askStartResult === 2) {
        return app.quit()
      }
      else if (askStartResult === 1) {
        config.autoStart = true
      }
    }
    if (!config.saiPath) {
      const findSaiResult = dialog.showOpenDialog(FIND_SAI_DIAG)
      if (!findSaiResult || !(config.saiPath = findSaiResult[0]) || !fs.existsSync(config.saiPath)) {
        return app.quit()
      }
    }
    cp.spawn(config.saiPath, { detached: true }).unref()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }

  setInterval(_ => {
    if (hook.isOK()) {
      hook.errorCount = 0
    }
    else if ((hook.errorCount = (hook.errorCount || 0) + 1) < 5) {
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

hook.on('pen-down', isReversed => {
  win && win.webContents.send('hook-pen-down', key)
})

hook.on('pen-up', isReversed => {
  win && win.webContents.send('hook-pen-up', key)
})

hook.on('touch-start', (x, y) => {
  console.log(x, y)
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

hook.setSaiCanvasRotation = throttled(hook.setSaiCanvasRotation.bind(hook), 30)
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
