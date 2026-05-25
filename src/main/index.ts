import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LOCAL_MEDIA_SCHEME, registerLocalMediaProtocol } from './localMedia/localProtocol'
import { registerLocalMediaIpc } from './localMedia/ipc'

const RENDERER_DIR = join(__dirname, '../renderer')

/** Production / preview: app://localhost origin (avoids file:// → Origin: null for canvas + CORS media). */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: LOCAL_MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

function resolveRendererPath(requestUrl: string): string {
  const { pathname } = new URL(requestUrl)
  let relative = decodeURIComponent(pathname)
  if (relative.startsWith('/')) relative = relative.slice(1)
  if (!relative || relative === '.') relative = 'index.html'
  return join(RENDERER_DIR, relative)
}

async function registerAppProtocol(): Promise<void> {
  await protocol.handle('app', (request) => {
    const filePath = resolveRendererPath(request.url)
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function isDevRendererServer(): boolean {
  return is.dev && Boolean(process.env['ELECTRON_RENDERER_URL'])
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDevRendererServer()) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadURL('app://localhost/index.html')
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  if (!isDevRendererServer()) {
    await registerAppProtocol()
  }
  await registerLocalMediaProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))
  registerLocalMediaIpc()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
