export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  openFile: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<string>
  readFileAsBase64: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  createFile: (filePath: string) => Promise<boolean>
  createFolder: (folderPath: string) => Promise<boolean>
  deleteItem: (itemPath: string) => Promise<boolean>
  renameItem: (oldPath: string, newPath: string) => Promise<boolean>
  revealInExplorer: (itemPath: string) => Promise<boolean>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowSetTitle: (title: string) => Promise<void>
  windowIsMaximized: () => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
