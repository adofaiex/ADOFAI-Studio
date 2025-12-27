import { app, BrowserWindow, ipcMain, dialog } from "electron"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..")

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"]
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron")
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist")

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"))
  }

  // Notify renderer about window state changes for icon toggle
  win.on("maximize", () => {
    win?.webContents.send("window:maximized", true)
  })
  win.on("unmaximize", () => {
    win?.webContents.send("window:maximized", false)
  })
  win.on("enter-full-screen", () => {
    win?.webContents.send("window:maximized", true)
  })
  win.on("leave-full-screen", () => {
    win?.webContents.send("window:maximized", !!win?.isMaximized())
  })
}

ipcMain.handle("app:getPath", (_event, name: any) => {
  return app.getPath(name)
})

ipcMain.handle("app:getAppPath", () => {
  return app.getAppPath()
})

ipcMain.handle("fs:exists", async (_event, filePath: string) => {
  return fs.existsSync(filePath)
})

ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ["openDirectory"],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle("dialog:openFile", async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ["openFile"],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle("fs:readDirectory", async (_event, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }))
  } catch (error) {
    console.error("Error reading directory:", error)
    return []
  }
})

ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8")
    return content
  } catch (error) {
    console.error("Error reading file:", error)
    throw error
  }
})

ipcMain.handle("fs:readFileAsBase64", async (_event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath)
    const base64 = content.toString("base64")
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
    }
    const mimeType = mimeTypes[ext] || "application/octet-stream"
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error("Error reading file as base64:", error)
    throw error
  }
})

ipcMain.handle("fs:writeFile", async (_event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, "utf-8")
    return true
  } catch (error) {
    console.error("Error writing file:", error)
    throw error
  }
})

ipcMain.handle("fs:createFile", async (_event, filePath: string) => {
  try {
    await fs.promises.writeFile(filePath, "", "utf-8")
    return true
  } catch (error) {
    console.error("Error creating file:", error)
    throw error
  }
})

ipcMain.handle("fs:createFolder", async (_event, folderPath: string) => {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true })
    return true
  } catch (error) {
    console.error("Error creating folder:", error)
    throw error
  }
})

ipcMain.handle("fs:deleteItem", async (_event, itemPath: string) => {
  try {
    const stat = await fs.promises.stat(itemPath)
    if (stat.isDirectory()) {
      await fs.promises.rm(itemPath, { recursive: true })
    } else {
      await fs.promises.unlink(itemPath)
    }
    return true
  } catch (error) {
    console.error("Error deleting item:", error)
    throw error
  }
})

ipcMain.handle("fs:renameItem", async (_event, oldPath: string, newPath: string) => {
  try {
    await fs.promises.rename(oldPath, newPath)
    return true
  } catch (error) {
    console.error("Error renaming item:", error)
    throw error
  }
})

ipcMain.handle("fs:revealInExplorer", async (_event, itemPath: string) => {
  try {
    const { shell } = require("electron")
    shell.showItemInFolder(itemPath)
    return true
  } catch (error) {
    console.error("Error revealing in explorer:", error)
    throw error
  }
})

// Window control handlers
ipcMain.handle("window:minimize", () => {
  win?.minimize()
})

ipcMain.handle("window:maximize", () => {
  if (win?.isMaximized()) {
    win?.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.handle("window:close", () => {
  win?.close()
})

ipcMain.handle("window:setTitle", (_event, title: string) => {
  win?.setTitle(title)
})

ipcMain.handle("window:isMaximized", () => {
  return !!win?.isMaximized()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
    win = null
  }
})

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
