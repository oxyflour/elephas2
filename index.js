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

const WND_OPTIONS = {
  frame: false,
  transparent: true,
  show: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  acceptFirstMouse: true,
}

let win

app.once('ready', _ => {
  win = new BrowserWindow(WND_OPTIONS)
  win.loadURL(`file://${__dirname}/html/index.html`)
  win.webContents.openDevTools({ mode: 'detach' })

  const packageJSON = require(path.join(__dirname, 'package.json')),
    configPath = path.join(app.getPath('home'), `${packageJSON.name}.json`),
    config = fs.existsSync(configPath) ? require(configPath) : { }

  if (!hook.isOK()) {
    const shouldStartSAI = {
      type: 'question',
      title: 'find sai2 failed',
      message: 'SAI2 seems not running. Would you like to start it?',
      buttons: ['OK', 'Cancel'],
    }
    if (!config.autoStart && !dialog.showMessageBox(shouldStartSAI) === 0) {
      return app.quit()
    }
    else {
      if (!config.saiPath) {
        const saiPath = dialog.showOpenDialog({
          title: 'where is sai2.exe?',
          filters: [{ name: 'sai2.exe', extensions: ['exe'] }],
        })[0]
        if (!saiPath && !fs.existsSync(saiPath)) {
          return app.quit()
        }
        else {
          config.saiPath = saiPath
        }
      }
      cp.execFile(config.saiPath, err => {
        if (err) {
          dialog.showErrorBox('Error', 'start sai2.exe failed')
          delete config.saiPath
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
          app.quit()
        }
        else {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
          hook.isPrepared = true
        }
      })
    }
  }
})

app.once('window-all-closed', _ => {
  hook.destroy()
  app.quit()
})

hook.on('hook-status', isOK => {
  if (hook.isPrepared &&
      (hook.errorCount = isOK ? 0 : (hook.errorCount || 0) + 1) > 5) {
    console.log('unable to find sai. quit.')
    hook.destroy()
    app.quit()
  }
})

hook.on('key-down', key => {
  win && win.webContents.send('hook-key-down', key)
})

hook.on('key-up', key => {
  win && win.webContents.send('hook-key-up', key)
})

hook.on('left-down', key => {
  win && win.webContents.send('hook-left-down', key)
})

hook.on('left-up', key => {
  win && win.webContents.send('hook-left-up', key)
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
