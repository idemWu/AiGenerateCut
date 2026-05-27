import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LOCAL_MEDIA_SCHEME, registerLocalMediaProtocol } from './localMedia/localProtocol'
import { registerLocalMediaIpc } from './localMedia/ipc'
import { registerStudioExportIpc } from './export/ipc'

const APP_NAME = 'Movie Utopia Studio'
const APP_USER_MODEL_ID = 'com.movieutopia.studio'
const WINDOW_BACKGROUND_COLOR = '#141414'
const TITLE_BAR_OVERLAY_HEIGHT = 40
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
    title: APP_NAME,
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: WINDOW_BACKGROUND_COLOR,
    autoHideMenuBar: true,
    icon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 16, y: 13 } }
      : {
          titleBarOverlay: {
            color: WINDOW_BACKGROUND_COLOR,
            symbolColor: '#f4f4f5',
            height: TITLE_BAR_OVERLAY_HEIGHT
          }
        }),
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
  app.setName(APP_NAME)
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  if (!isDevRendererServer()) {
    await registerAppProtocol()
  }
  await registerLocalMediaProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))
  registerLocalMediaIpc()
  registerStudioExportIpc()

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
