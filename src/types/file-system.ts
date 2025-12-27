export interface FileItem {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileItem[]
}

export interface EditorTab {
  id: string
  path: string
  name: string
  content: string
  modified: boolean
  language: string
}

export type ViewMode = "source" | "adofai"

export interface ADOFAICategory {
  maps: FileItem[]
  decorations: FileItem[]
  miscellaneous: FileItem[]
  readme?: FileItem
}
