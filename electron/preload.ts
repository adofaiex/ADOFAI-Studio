import { ipcRenderer, contextBridge } from "electron"

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld("electronAPI", {
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  readDirectory: (dirPath: string) => ipcRenderer.invoke("fs:readDirectory", dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  readFileAsBase64: (filePath: string) => ipcRenderer.invoke("fs:readFileAsBase64", filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("fs:writeFile", filePath, content),
  createFile: (filePath: string) => ipcRenderer.invoke("fs:createFile", filePath),
  createFolder: (folderPath: string) => ipcRenderer.invoke("fs:createFolder", folderPath),
  deleteItem: (itemPath: string) => ipcRenderer.invoke("fs:deleteItem", itemPath),
  renameItem: (oldPath: string, newPath: string) => ipcRenderer.invoke("fs:renameItem", oldPath, newPath),
  revealInExplorer: (itemPath: string) => ipcRenderer.invoke("fs:revealInExplorer", itemPath),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowSetTitle: (title: string) => ipcRenderer.invoke("window:setTitle", title),
  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),
})
