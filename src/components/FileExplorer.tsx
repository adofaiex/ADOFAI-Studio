"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  ImageIcon,
  Music,
  ChevronUp,
} from "lucide-react"
import type { FileEntry } from "../types/electron"
import type { ViewMode } from "../types/file-system"
import StringParser from "../lib/StringParser"
import { type Language, useTranslation } from "../lib/i18n"
import { Level } from "adofai"

interface FileExplorerProps {
  onFileSelect: (filePath: string, viewMode?: "design" | "source") => void
  selectedFile: string | null
  language: Language
  theme?: string
  rootPath: string | null
  onRootPathChange: (path: string | null) => void
  isCollapsed?: boolean
  onToggleCollapse?: (collapsed: boolean) => void
  onTransformFile?: (path: string, content: string) => void
}

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  isExpanded?: boolean
}

interface ADOFAIFile {
  path: string
  name: string
  data?: any
}

interface ContextMenuState {
  x: number
  y: number
  targetPath: string
  isDirectory: boolean
}

type PresetType = "exclude" | "special"
interface Preset {
  type: PresetType
  events: string[]
}

const preset_noeffect: Preset = {
  type: "exclude",
  events: [
    "Flash",
    "SetFilter",
    "SetFilterAdvanced",
    "HallOfMirrors",
    "Bloom",
    "ScalePlanets",
    "ScreenTile",
    "ScreenScroll",
    "ShakeScreen",
  ],
}

const preset_noholds_experimental: Preset = { type: "exclude", events: ["Hold"] }
const preset_nomovecamera: Preset = { type: "exclude", events: ["MoveCamera"] }

const preset_noeffect_completely: Preset = {
  type: "exclude",
  events: [
    "AddDecoration",
    "AddText",
    "AddObject",
    "Checkpoint",
    "SetHitsound",
    "PlaySound",
    "SetPlanetRotation",
    "ScalePlanets",
    "ColorTrack",
    "AnimateTrack",
    "RecolorTrack",
    "MoveTrack",
    "PositionTrack",
    "MoveDecorations",
    "SetText",
    "SetObject",
    "SetDefaultText",
    "CustomBackground",
    "Flash",
    "MoveCamera",
    "SetFilter",
    "HallOfMirrors",
    "ShakeScreen",
    "Bloom",
    "ScreenTile",
    "ScreenScroll",
    "SetFrameRate",
    "RepeatEvents",
    "SetConditionalEvents",
    "EditorComment",
    "Bookmark",
    "Hold",
    "SetHoldSound",
    "Hide",
    "ScaleMargin",
    "ScaleRadius",
  ],
}

const preset_inner_no_deco: Preset = {
  type: "special",
  events: ["MoveDecorations", "SetText", "SetObject", "SetDefaultText"],
}

const presets: Record<string, Preset> = {
  preset_noeffect,
  "preset_noholds(Experimental)": preset_noholds_experimental,
  preset_nomovecamera,
  preset_noeffect_completely,
}

export function FileExplorer({
  onFileSelect,
  selectedFile,
  language,
  rootPath,
  onRootPathChange,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
  onTransformFile,
}: FileExplorerProps) {
  const t = useTranslation(language)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("source")
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)

  const isCollapsed = externalIsCollapsed ?? internalIsCollapsed
  const setIsCollapsed = onToggleCollapse ?? setInternalIsCollapsed
  const [adofaiData, setAdofaiData] = useState<{
    levels: ADOFAIFile[]
    decorations: string[]
    audio: string[]
    miscellaneous: string[]
    readme?: string
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [isViewSelectorOpen, setIsViewSelectorOpen] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean
    title: string
    defaultValue: string
    callback: (value: string | null) => void
  }>({
    isOpen: false,
    title: "",
    defaultValue: "",
    callback: () => {},
  })
  const [selectDialog, setSelectDialog] = useState<{
    isOpen: boolean
    title: string
    options: string[]
    callback: (value: string | null) => void
  }>({
    isOpen: false,
    title: "",
    options: [],
    callback: () => {},
  })
  const viewSelectorRef = useRef<HTMLDivElement>(null)

  const showPrompt = (title: string, defaultValue: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptDialog({
        isOpen: true,
        title,
        defaultValue,
        callback: (value) => {
          setPromptDialog((prev) => ({ ...prev, isOpen: false }))
          resolve(value)
        },
      })
    })
  }
  const showSelect = (title: string, options: string[]): Promise<string | null> => {
    return new Promise((resolve) => {
      setSelectDialog({
        isOpen: true,
        title,
        options,
        callback: (value) => {
          setSelectDialog((prev) => ({ ...prev, isOpen: false }))
          resolve(value)
        },
      })
    })
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewSelectorRef.current && !viewSelectorRef.current.contains(e.target as Node)) {
        setIsViewSelectorOpen(false)
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }

    if (contextMenu || isViewSelectorOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [contextMenu, isViewSelectorOpen])

  const handleOpenFolder = async () => {
    const folderPath = await window.electronAPI.openFolder()
    if (folderPath) {
      onRootPathChange(folderPath)
      await loadDirectory(folderPath)
      if (viewMode === "adofai") {
        await analyzeADOFAIStructure(folderPath)
      }
    }
  }

  const refreshDirectory = async () => {
    if (rootPath) {
      await loadDirectory(rootPath)
      if (viewMode === "adofai") {
        await analyzeADOFAIStructure(rootPath)
      }
    }
  }

  const analyzeADOFAIStructure = async (dirPath: string) => {
    try {
      const entries = await window.electronAPI.readDirectory(dirPath)
      const levels: ADOFAIFile[] = []
      const allFiles: string[] = []
      const decorationImages = new Set<string>()
      let readme: string | undefined

      for (const entry of entries) {
        if (entry.isDirectory) continue

        allFiles.push(entry.path)

        if (entry.name.toLowerCase() === "readme.md") {
          readme = entry.path
        }

        if (entry.name.endsWith(".adofai")) {
          try {
            const content = await window.electronAPI.readFile(entry.path)
            const parser = new StringParser()
            const data = parser.parse(content)
            levels.push({ path: entry.path, name: entry.name, data })

            if (data?.decorations && Array.isArray(data.decorations)) {
              for (const decoration of data.decorations) {
                if (decoration.decorationImage) {
                  decorationImages.add(decoration.decorationImage.toLowerCase())
                }
              }
            }
          } catch (error) {
            console.error(`Failed to parse ${entry.name}:`, error)
            levels.push({ path: entry.path, name: entry.name })
          }
        }
      }

      const decorations: string[] = []
      const audio: string[] = []
      const miscellaneous: string[] = []

      for (const filePath of allFiles) {
        const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() || ""

        if (fileName.endsWith(".adofai") || fileName.toLowerCase() === "readme.md") {
          continue
        }

        const isImage = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(fileName)
        const isAudio = /\.(mp3|wav|ogg|flac|m4a)$/i.test(fileName)

        if (isImage && decorationImages.has(fileName)) {
          decorations.push(filePath)
        } else if (isAudio) {
          audio.push(filePath)
        } else {
          miscellaneous.push(filePath)
        }
      }

      setAdofaiData({ levels, decorations, audio, miscellaneous, readme })
    } catch (error) {
      console.error("Failed to analyze ADOFAI structure:", error)
    }
  }

  useEffect(() => {
    if (rootPath && viewMode === "adofai") {
      analyzeADOFAIStructure(rootPath)
    }
  }, [viewMode, rootPath])

  useEffect(() => {
    if (rootPath) {
      loadDirectory(rootPath)
    }
  }, [rootPath])

  const loadDirectory = async (dirPath: string, parentNodes: TreeNode[] = tree, nodePath: string[] = []) => {
    const entries = await window.electronAPI.readDirectory(dirPath)
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
      return a.isDirectory ? -1 : 1
    })

    if (nodePath.length === 0) {
      setTree(sortedEntries.map((e) => ({ ...e, isExpanded: false, children: [] })))
    } else {
      setTree((prev) => updateTreeNode(prev, nodePath, sortedEntries))
    }
  }

  const updateTreeNode = (nodes: TreeNode[], path: string[], newChildren: FileEntry[]): TreeNode[] => {
    if (path.length === 0) return nodes

    return nodes.map((node) => {
      if (node.name === path[0]) {
        if (path.length === 1) {
          return {
            ...node,
            children: newChildren.map((e) => ({ ...e, isExpanded: false, children: [] })),
            isExpanded: true,
          }
        }
        return {
          ...node,
          children: updateTreeNode(node.children || [], path.slice(1), newChildren),
        }
      }
      return node
    })
  }

  const toggleNode = async (node: TreeNode, path: string[]) => {
    if (!node.isDirectory) {
      onFileSelect(node.path)
      return
    }

    if (!node.isExpanded) {
      await loadDirectory(node.path, tree, path)
    } else {
      setTree((prev) => toggleExpanded(prev, path))
    }
  }

  const toggleExpanded = (nodes: TreeNode[], path: string[]): TreeNode[] => {
    if (path.length === 0) return nodes

    return nodes.map((node) => {
      if (node.name === path[0]) {
        if (path.length === 1) {
          return { ...node, isExpanded: !node.isExpanded }
        }
        return {
          ...node,
          children: toggleExpanded(node.children || [], path.slice(1)),
        }
      }
      return node
    })
  }

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    e.stopPropagation()

    // Position menu initially at cursor
    let x = e.clientX
    let y = e.clientY

    // We'll adjust the position in a useEffect after the menu is rendered
    // or just use a simple estimate for now, then refine.
    const menuWidth = 220
    const menuHeight = 320

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }

    setContextMenu({
      x,
      y,
      targetPath: node.path,
      isDirectory: node.isDirectory,
    })
  }

  // Effect to refine context menu position after it's rendered
  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const rect = contextMenuRef.current.getBoundingClientRect()
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight

      let { x, y } = contextMenu
      let adjusted = false

      if (x + rect.width > winWidth) {
        x = winWidth - rect.width - 10
        adjusted = true
      }
      if (y + rect.height > winHeight) {
        y = winHeight - rect.height - 10
        adjusted = true
      }

      if (adjusted) {
        setContextMenu((prev) => (prev ? { ...prev, x, y } : null))
      }
    }
  }, [contextMenu?.x, contextMenu?.y]) // Only trigger when x/y change initially

  const handleNewFile = async () => {
    if (!contextMenu) return
    const fileName = await showPrompt(t.enterFileName, "")
    if (fileName) {
      const basePath = contextMenu.isDirectory
        ? contextMenu.targetPath
        : contextMenu.targetPath.split(/[\\/]/).slice(0, -1).join("/")
      const filePath = `${basePath}/${fileName}`
      try {
        await window.electronAPI.createFile(filePath)
        alert(t.createSuccess)
        await refreshDirectory()
      } catch (error) {
        alert(t.createFailed)
      }
    }
    setContextMenu(null)
  }

  const handleNewFolder = async () => {
    if (!contextMenu) return
    const folderName = await showPrompt(t.enterFolderName, "")
    if (folderName) {
      const basePath = contextMenu.isDirectory
        ? contextMenu.targetPath
        : contextMenu.targetPath.split(/[\\/]/).slice(0, -1).join("/")
      const folderPath = `${basePath}/${folderName}`
      try {
        await window.electronAPI.createFolder(folderPath)
        alert(t.createSuccess)
        await refreshDirectory()
      } catch (error) {
        alert(t.createFailed)
      }
    }
    setContextMenu(null)
  }

  const handleRename = async () => {
    if (!contextMenu) return
    const oldName = contextMenu.targetPath.split(/[\\/]/).pop() || ""
    const newName = await showPrompt(t.enterNewName, oldName)
    if (newName && newName !== oldName) {
      const basePath = contextMenu.targetPath.split(/[\\/]/).slice(0, -1).join("/")
      const newPath = `${basePath}/${newName}`
      try {
        await window.electronAPI.renameItem(contextMenu.targetPath, newPath)

        // If it's a decoration (image file), update references in .adofai files
        const isImage = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(oldName)
        if (isImage && rootPath) {
          const entries = await window.electronAPI.readDirectory(rootPath)
          for (const entry of entries) {
            if (entry.name.endsWith(".adofai")) {
              try {
                const content = await window.electronAPI.readFile(entry.path)
                // Use a regex to find and replace the decoration image filename
                // ADOFAI files use "decorationImage": "filename.png"
                const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                const regex = new RegExp(`"decorationImage"\\s*:\\s*"${escapedOldName}"`, "g")

                if (regex.test(content)) {
                  const newContent = content.replace(regex, `"decorationImage": "${newName}"`)
                  await window.electronAPI.writeFile(entry.path, newContent)
                  console.log(`Updated references in ${entry.name}`)
                }
              } catch (err) {
                console.error(`Failed to update references in ${entry.name}:`, err)
              }
            }
          }
        }

        alert(t.renameSuccess)
        await refreshDirectory()
      } catch (error) {
        alert(t.renameFailed)
      }
    }
    setContextMenu(null)
  }

  const handleDelete = async () => {
    if (!contextMenu) return
    if (confirm(t.confirmDelete)) {
      try {
        await window.electronAPI.deleteItem(contextMenu.targetPath)
        alert(t.deleteSuccess)
        await refreshDirectory()
      } catch (error) {
        alert(t.deleteFailed)
      }
    }
    setContextMenu(null)
  }

  const handleCopyPath = () => {
    if (!contextMenu) return
    navigator.clipboard.writeText(contextMenu.targetPath)
    setContextMenu(null)
  }

  const handleCopyRelativePath = () => {
    if (!contextMenu || !rootPath) return
    const relativePath = contextMenu.targetPath.replace(rootPath, "").replace(/^[\\/]/, "")
    navigator.clipboard.writeText(relativePath)
    setContextMenu(null)
  }

  const handleRevealInExplorer = async () => {
    if (!contextMenu) return
    try {
      await window.electronAPI.revealInExplorer(contextMenu.targetPath)
    } catch (error) {
      console.error("Failed to reveal in explorer:", error)
    }
    setContextMenu(null)
  }

  const handleClearEffect = async () => {
    if (!contextMenu) return
    const target = contextMenu.targetPath
    if (!target.endsWith(".adofai")) {
      setContextMenu(null)
      return
    }
    try {
      const presetName = await showSelect(t.selectPreset, Object.keys(presets))
      if (!presetName) {
        setContextMenu(null)
        return
      }
      const content = await window.electronAPI.readFile(target)
      const parser = new StringParser()
      const level = new Level(content, parser)
      await new Promise<void>((resolve) => {
        level.on("load", () => resolve())
        level.load()
      })
      const preset = presets[presetName]
      ;(level as any).clearEvent(preset)
      const output = (level as any).export()
      if (onTransformFile) {
        onTransformFile(target, output)
      }
      await window.electronAPI.writeFile(target, output)
      alert(t.clearEffect + " " + t.createSuccess)
    } catch (error) {
      console.error("Failed to clear effects:", error)
      alert(t.clearEffect + " " + t.createFailed)
    }
    setContextMenu(null)
  }

  const handleClearDeco = async () => {
    if (!contextMenu) return
    const target = contextMenu.targetPath
    if (!target.endsWith(".adofai")) {
      setContextMenu(null)
      return
    }
    try {
      const content = await window.electronAPI.readFile(target)
      const parser = new StringParser()
      const level = new Level(content, parser)
      await new Promise<void>((resolve) => {
        level.on("load", () => resolve())
        level.load()
      })
      ;(level as any).clearDeco()
      const output = (level as any).export()
      if (onTransformFile) {
        onTransformFile(target, output)
      }
      await window.electronAPI.writeFile(target, output)
      alert(t.clearDeco + " " + t.createSuccess)
    } catch (error) {
      console.error("Failed to clear decorations:", error)
      alert(t.clearDeco + " " + t.createFailed)
    }
    setContextMenu(null)
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".adofai")) {
      return <FileCode size={16} className="text-[#6aafff]" />
    }
    if (/\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(fileName)) {
      return <ImageIcon size={16} className="text-[#a8dadc]" />
    }
    if (/\.(mp3|wav|ogg|flac|m4a)$/i.test(fileName)) {
      return <Music size={16} className="text-[#ff6b9d]" />
    }
    return <FileText size={16} className="text-zinc-400" />
  }

  const truncateFileName = (name: string, maxLength = 25) => {
    if (name.length <= maxLength) return name
    const extIndex = name.lastIndexOf(".")
    const ext = extIndex > 0 ? name.substring(extIndex) : ""
    const nameWithoutExt = extIndex > 0 ? name.substring(0, extIndex) : name
    const keepChars = maxLength - ext.length - 3
    if (keepChars <= 0) return name.substring(0, maxLength - 3) + "..."
    const halfKeep = Math.floor(keepChars / 2)
    return (
      nameWithoutExt.substring(0, halfKeep) + "..." + nameWithoutExt.substring(nameWithoutExt.length - halfKeep) + ext
    )
  }

  const renderTree = (nodes: TreeNode[], depth = 0, path: string[] = []): React.ReactNode[] => {
    return nodes.map((node, index) => {
      const currentPath = [...path, node.name]
      const isSelected = selectedFile === node.path

      return (
        <div key={`${node.path}-${index}`}>
          <div
            className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
              isSelected ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)] text-[var(--foreground)]"
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleNode(node, currentPath)}
            onContextMenu={(e) => handleContextMenu(e, node)}
          >
            {node.isDirectory ? (
              <>
                {node.isExpanded ? (
                  <ChevronDown size={16} className={isSelected ? "text-white" : "text-[var(--foreground)] opacity-50"} />
                ) : (
                  <ChevronRight size={16} className={isSelected ? "text-white" : "text-[var(--foreground)] opacity-50"} />
                )}
                {node.isExpanded ? (
                  <FolderOpen size={16} className="text-[#dcb67a]" />
                ) : (
                  <Folder size={16} className="text-[#dcb67a]" />
                )}
              </>
            ) : (
              <>
                <span className="w-4" />
                {getFileIcon(node.name)}
              </>
            )}
            <span className="text-sm ml-1 truncate" title={node.name}>
              {truncateFileName(node.name)}
            </span>
          </div>
          {node.isExpanded && node.children && <div>{renderTree(node.children, depth + 1, currentPath)}</div>}
        </div>
      )
    })
  }

  const renderADOFAIView = () => {
    if (!adofaiData) return null

    const { levels, decorations, audio, miscellaneous, readme } = adofaiData

    const createFileNode = (filePath: string): TreeNode => {
      const fileName = filePath.split(/[\\/]/).pop() || ""
      return {
        name: fileName,
        path: filePath,
        isDirectory: false,
        isExpanded: false,
        children: [],
      }
    }

    return (
      <div className="py-2">
        {readme && (
          <div className="mb-4">
            <div
              className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
                selectedFile === readme ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)] text-[var(--foreground)]"
              }`}
              onClick={() => onFileSelect(readme)}
              onContextMenu={(e) => handleContextMenu(e, createFileNode(readme))}
            >
              <FileText size={16} className="text-[#6aafff]" />
              <span className="text-sm ml-1 font-semibold">README.md</span>
            </div>
          </div>
        )}

        <div className="mb-2">
            <div
              className="px-2 py-1 text-xs font-semibold text-[var(--foreground)] opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100 transition-colors"
              onClick={() => toggleCategory("levels")}
            >
              {collapsedCategories.has("levels") ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {t.levels} ({levels.length})
            </div>
          {!collapsedCategories.has("levels") &&
            levels.map((level) => {
              const isSelected = selectedFile === level.path
              return (
                <div
                  key={level.path}
                  className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
                    isSelected ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)] text-[var(--foreground)]"
                  }`}
                  style={{ paddingLeft: "20px" }}
                  onClick={() => onFileSelect(level.path)}
                  onContextMenu={(e) => handleContextMenu(e, createFileNode(level.path))}
                >
                  <FileCode size={16} className="text-[#6aafff]" />
                  <span className="text-sm ml-1 truncate" title={level.name}>
                    {truncateFileName(level.name)}
                  </span>
                </div>
              )
            })}
        </div>

        {decorations.length > 0 && (
          <div className="mb-2">
            <div
              className="px-2 py-1 text-xs font-semibold text-[var(--foreground)] opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100 transition-colors"
              onClick={() => toggleCategory("decorations")}
            >
              {collapsedCategories.has("decorations") ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {t.decorations} ({decorations.length})
            </div>
            {!collapsedCategories.has("decorations") &&
              decorations.map((filePath) => {
                const fileName = filePath.split(/[\\/]/).pop() || ""
                const isSelected = selectedFile === filePath
                return (
                  <div
                    key={filePath}
                    className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
                      isSelected ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)] text-[var(--foreground)]"
                    }`}
                    style={{ paddingLeft: "20px" }}
                    onClick={() => onFileSelect(filePath)}
                    onContextMenu={(e) => handleContextMenu(e, createFileNode(filePath))}
                  >
                    <ImageIcon size={16} className="text-[#a8dadc]" />
                    <span className="text-sm ml-1 truncate" title={fileName}>
                      {truncateFileName(fileName)}
                    </span>
                  </div>
                )
              })}
          </div>
        )}

        {audio.length > 0 && (
          <div className="mb-2">
            <div
              className="px-2 py-1 text-xs font-semibold text-[var(--foreground)] opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100 transition-colors"
              onClick={() => toggleCategory("audio")}
            >
              {collapsedCategories.has("audio") ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {t.audio} ({audio.length})
            </div>
            {!collapsedCategories.has("audio") &&
              audio.map((filePath) => {
                const fileName = filePath.split(/[\\/]/).pop() || ""
                const isSelected = selectedFile === filePath
                return (
                  <div
                    key={filePath}
                    className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
                      isSelected ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)] text-[var(--foreground)]"
                    }`}
                    style={{ paddingLeft: "20px" }}
                    onClick={() => onFileSelect(filePath)}
                    onContextMenu={(e) => handleContextMenu(e, createFileNode(filePath))}
                  >
                    <Music size={16} className="text-[#ff6b9d]" />
                    <span className="text-sm ml-1 truncate" title={fileName}>
                      {truncateFileName(fileName)}
                    </span>
                  </div>
                )
              })}
          </div>
        )}

        {miscellaneous.length > 0 && (
          <div>
            <div
              className="px-2 py-1 text-xs font-semibold text-[var(--foreground)] opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100 transition-colors"
              onClick={() => toggleCategory("miscellaneous")}
            >
              {collapsedCategories.has("miscellaneous") ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {t.miscellaneous} ({miscellaneous.length})
            </div>
            {!collapsedCategories.has("miscellaneous") &&
              miscellaneous.map((filePath) => {
                const fileName = filePath.split(/[\\/]/).pop() || ""
                const isSelected = selectedFile === filePath
                return (
                  <div
                    key={filePath}
                    className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
                      isSelected ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--hover)] text-[var(--foreground)]"
                    }`}
                    style={{ paddingLeft: "20px" }}
                    onClick={() => onFileSelect(filePath)}
                    onContextMenu={(e) => handleContextMenu(e, createFileNode(filePath))}
                  >
                    {getFileIcon(fileName)}
                    <span className="text-sm ml-1 truncate" title={fileName}>
                      {truncateFileName(fileName)}
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col items-center py-3">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-[var(--hover)] rounded transition-colors"
          title={t.solutionExplorer}
        >
          <ChevronRight size={16} className="text-[var(--foreground)] opacity-50" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col select-none">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <h2 className="text-xs font-medium text-[var(--foreground)] opacity-50 tracking-wide truncate">{t.solutionExplorer}</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-[var(--hover)] rounded transition-colors shrink-0"
          title="Collapse"
        >
          <ChevronUp size={14} className="text-[var(--foreground)] opacity-50 rotate-[-90deg]" />
        </button>
      </div>

      {rootPath && (
        <div className="px-3 py-2 border-b border-[var(--border)] shrink-0">
          <div className="relative" ref={viewSelectorRef}>
            <button
              onClick={() => setIsViewSelectorOpen(!isViewSelectorOpen)}
              className={`w-full h-8 px-2 py-1.5 text-xs bg-[var(--background)] rounded border border-[var(--border)] transition-all flex items-center justify-between group overflow-hidden ${
                isViewSelectorOpen ? "border-[var(--accent)] text-[var(--foreground)]" : "text-[var(--foreground)] opacity-70 hover:bg-[var(--hover)] hover:opacity-100"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {viewMode === "source" ? <FileCode size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                <span className="font-medium truncate">{viewMode === "source" ? t.sourceFiles : t.adofaiView}</span>
              </div>
              <ChevronDown
                size={12}
                className={`shrink-0 transition-transform duration-200 ${isViewSelectorOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isViewSelectorOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--menu-background)] border border-[var(--border)] rounded shadow-xl z-50 py-1">
                <button
                  onClick={() => {
                    setViewMode("source")
                    setIsViewSelectorOpen(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[var(--accent)] hover:text-white transition-colors ${
                    viewMode === "source" ? "text-[var(--accent)]" : "text-[var(--foreground)] opacity-70"
                  }`}
                >
                  <span className="truncate">{t.sourceFiles}</span>
                  {viewMode === "source" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
                </button>
                <button
                  onClick={() => {
                    setViewMode("adofai")
                    setIsViewSelectorOpen(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[var(--accent)] hover:text-white transition-colors ${
                    viewMode === "adofai" ? "text-[var(--accent)]" : "text-[var(--foreground)] opacity-70"
                  }`}
                >
                  <span className="truncate">{t.adofaiView}</span>
                  {viewMode === "adofai" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {rootPath ? (
          viewMode === "source" ? (
            <div className="py-2">{renderTree(tree)}</div>
          ) : (
            renderADOFAIView()
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--foreground)] opacity-50 text-sm px-4 gap-3">
            <div className="text-center">{t.noFolderOpen}</div>
            <button
              onClick={handleOpenFolder}
              className="px-3 py-1.5 text-xs bg-[var(--accent)] hover:opacity-90 text-white rounded transition-colors"
            >
              {t.openFolder}
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[var(--menu-background)] border border-[var(--border)] rounded shadow-lg py-1 z-[1000] min-w-[200px] max-h-[400px] overflow-y-auto"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleNewFile}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.newFile}
          </button>
          <button
            onClick={handleNewFolder}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.newFolder}
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button
            onClick={handleRename}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.rename}
          </button>
          {contextMenu.targetPath.endsWith(".adofai") && (
            <>
              <button
                onClick={() => {
                  onFileSelect(contextMenu.targetPath, "design")
                  setContextMenu(null)
                }}
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {t.openInDesignView}
              </button>
              <button
                onClick={() => {
                  onFileSelect(contextMenu.targetPath, "source")
                  setContextMenu(null)
                }}
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {t.openInSourceView}
              </button>
              <div className="border-t border-[var(--border)] my-1" />
              <button
                onClick={handleClearEffect}
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {t.clearEffect}
              </button>
              <button
                onClick={handleClearDeco}
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {t.clearDeco}
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.delete}
          </button>
          <button
            onClick={handleCopyPath}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.copyPath}
          </button>
          <button
            onClick={handleCopyRelativePath}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.copyRelativePath}
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button
            onClick={handleRevealInExplorer}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.revealInExplorer}
          </button>
          <button
            onClick={() => {
              refreshDirectory()
              setContextMenu(null)
            }}
            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.refresh}
          </button>
        </div>
      )}

      {/* Prompt Dialog */}
      {promptDialog.isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--menu-background)] border border-[var(--border)] rounded-lg shadow-2xl w-[400px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)]">
              <h3 className="text-sm font-medium text-[var(--foreground)]">{promptDialog.title}</h3>
            </div>
            <div className="p-4">
              <input
                autoFocus
                type="text"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                defaultValue={promptDialog.defaultValue}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    promptDialog.callback(e.currentTarget.value)
                  } else if (e.key === "Escape") {
                    promptDialog.callback(null)
                  }
                }}
              />
            </div>
            <div className="px-4 py-3 bg-[var(--sidebar)] flex justify-end gap-2">
              <button
                className="px-4 py-1.5 text-xs text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-[var(--hover)] rounded transition-colors"
                onClick={() => promptDialog.callback(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-xs bg-[var(--accent)] text-white hover:opacity-90 rounded transition-colors"
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.previousElementSibling?.querySelector("input") as HTMLInputElement
                  promptDialog.callback(input?.value || "")
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {selectDialog.isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--menu-background)] border border-[var(--border)] rounded-lg shadow-2xl w-[420px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)]">
              <h3 className="text-sm font-medium text-[var(--foreground)]">{selectDialog.title}</h3>
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto">
              {selectDialog.options.map((opt) => (
                <button
                  key={opt}
                  className="w-full text-left px-3 py-2 rounded text-sm text-[var(--foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--hover)]"
                  onClick={() => selectDialog.callback(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="px-4 py-3 bg-[var(--sidebar)] flex justify-end">
              <button
                className="px-4 py-1.5 text-xs text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-[var(--hover)] rounded transition-colors"
                onClick={() => selectDialog.callback(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
