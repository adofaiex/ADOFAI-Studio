"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { FileExplorer } from "./components/FileExplorer"
import { EditorPane } from "./components/EditorPane"
import { MenuBar } from "./components/MenuBar"
import { TabBar } from "./components/TabBar"
import { StatusBar } from "./components/StatusBar"
import { TitleBar } from "./components/TitleBar"
import type { EditorTab } from "./types/file-system"
import { useTranslation, loadExternalTranslations, translations } from "./lib/i18n"
import type { Language } from "./lib/i18n"
import type { ThemeType } from "./types/theme"
import { themes } from "./types/theme"

function App() {
  const editorPaneRef = useRef<any>(null)
  const [tabs, setTabs] = useState<EditorTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  
  // Initialize from localStorage
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adofai-studio-language") || "en"
    }
    return "en"
  })
  
  const [theme, setTheme] = useState<ThemeType>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("adofai-studio-theme") as ThemeType) || "dark"
    }
    return "dark"
  })

  const [isElectron, setIsElectron] = useState(false)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [explorerWidth, setExplorerWidth] = useState(260)
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, string>>({}) // path -> content
  const [externalLangsLoaded, setExternalLangsLoaded] = useState(false)

  // Load external translations and persistent config
  useEffect(() => {
    const initApp = async () => {
      setIsElectron(typeof window !== "undefined" && window.electronAPI !== undefined)
      
      if (window.electronAPI) {
        // Load external translations
        await loadExternalTranslations()
        setExternalLangsLoaded(true)

        // Load config file
        try {
          const userDataPath = await window.electronAPI.getPath("userData")
          const configPath = `${userDataPath}/config.json`.replace(/\\/g, "/")
          const exists = await window.electronAPI.exists(configPath)
          
          if (exists) {
            const configContent = await window.electronAPI.readFile(configPath)
            const config = JSON.parse(configContent)
            if (config.language) setLanguage(config.language)
            if (config.theme) setTheme(config.theme)
          }
        } catch (e) {
          console.error("Failed to load config file", e)
        }
      }
    }
    
    initApp()
  }, [])

  // Persist settings to localStorage and config file
  useEffect(() => {
    localStorage.setItem("adofai-studio-language", language)
    localStorage.setItem("adofai-studio-theme", theme)

    const saveConfig = async () => {
      if (window.electronAPI) {
        try {
          const userDataPath = await window.electronAPI.getPath("userData")
          const configPath = `${userDataPath}/config.json`.replace(/\\/g, "/")
          const config = { language, theme }
          await window.electronAPI.writeFile(configPath, JSON.stringify(config, null, 2))
        } catch (e) {
          console.error("Failed to save config file", e)
        }
      }
    }
    
    saveConfig()
  }, [language, theme])

  useEffect(() => {
    const currentTheme = themes[theme]
    const root = document.documentElement
    Object.entries(currentTheme).forEach(([key, value]) => {
      // Convert camelCase to kebab-case for CSS variables
      const cssKey = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`
      root.style.setProperty(cssKey, value)
    })
    // Also set a data-theme attribute for CSS targeting
    root.setAttribute("data-theme", theme)
  }, [theme])

  const handleFileSelect = async (filePath: string, viewMode?: "design" | "source") => {
    const existingTab = tabs.find((tab) => tab.path === filePath)
    if (existingTab) {
      if (viewMode && existingTab.editorViewMode !== viewMode) {
        setTabs((prev) =>
          prev.map((tab) => (tab.id === existingTab.id ? { ...tab, editorViewMode: viewMode } : tab)),
        )
      }
      setActiveTabId(existingTab.id)
      return
    }

    try {
      const isImage = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(filePath)
      const isAudio = /\.(mp3|wav|ogg|flac|m4a)$/i.test(filePath)
      const content = isImage || isAudio ? "" : await window.electronAPI.readFile(filePath)
      const fileName = filePath.split(/[\\/]/).pop() || "untitled"
      const languageType = getLanguageFromPath(filePath)
      const isAdofai = filePath.endsWith(".adofai")

      const unsavedContent = unsavedChanges[filePath]
      const finalContent = unsavedContent !== undefined ? unsavedContent : content
      const isModified = unsavedContent !== undefined && unsavedContent !== content

      const newTab: EditorTab = {
        id: `tab-${Date.now()}-${Math.random()}`,
        path: filePath,
        name: fileName,
        content: finalContent,
        modified: isModified,
        language: languageType,
        editorViewMode: viewMode || (isAdofai ? "design" : "source"),
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } catch (error) {
      console.error("Failed to open file:", error)
    }
  }

  const handleOpenFile = async () => {
    const filePath = await window.electronAPI?.openFile()
    if (filePath) {
      setRootPath(null)
      await handleFileSelect(filePath)
    }
  }

  const handleOpenFolder = async () => {
    const folderPath = await window.electronAPI?.openFolder()
    if (folderPath) {
      setRootPath(folderPath)
    }
  }

  const getLanguageFromPath = (path: string): string => {
    if (path.endsWith(".adofai")) return "json"
    if (path.endsWith(".json")) return "json"
    if (path.endsWith(".js")) return "javascript"
    if (path.endsWith(".ts")) return "typescript"
    if (path.endsWith(".tsx")) return "typescript"
    if (path.endsWith(".jsx")) return "javascript"
    if (path.endsWith(".html")) return "html"
    if (path.endsWith(".css")) return "css"
    if (path.endsWith(".md")) return "markdown"
    return "plaintext"
  }

  const handleTabClose = (tabId: string) => {
    const newTabs = tabs.filter((tab) => tab.id !== tabId)
    setTabs(newTabs)

    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
    }
  }

  const handleContentChange = useCallback((tabId: string, content: string, modified: boolean) => {
    setTabs((prev) => {
      const updatedTabs = prev.map((tab) => {
        if (tab.id === tabId) {
          if (modified) {
            setUnsavedChanges((prevChanges) => ({ ...prevChanges, [tab.path]: content }))
          } else {
            setUnsavedChanges((prevChanges) => {
              const newChanges = { ...prevChanges }
              delete newChanges[tab.path]
              return newChanges
            })
          }
          return { ...tab, content, modified }
        }
        return tab
      })
      return updatedTabs
    })
  }, [])

  const handleSave = useCallback((tabId: string, content: string) => {
    setTabs((prev) => {
      const updatedTabs = prev.map((tab) => {
        if (tab.id === tabId) {
          setUnsavedChanges((prevChanges) => {
            const newChanges = { ...prevChanges }
            delete newChanges[tab.path]
            return newChanges
          })
          return { ...tab, content, modified: false }
        }
        return tab
      })
      return updatedTabs
    })
  }, [])

  const handleSaveAll = async () => {
    const modifiedTabs = tabs.filter((tab) => tab.modified)
    for (const tab of modifiedTabs) {
      try {
        await window.electronAPI.writeFile(tab.path, tab.content)
        handleSave(tab.id, tab.content)
      } catch (error) {
        console.error(`Failed to save ${tab.name}:`, error)
      }
    }
  }

  const handleTransformFile = (path: string, newContent: string) => {
    setUnsavedChanges((prev) => ({ ...prev, [path]: newContent }))
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], content: newContent, modified: true }
        return updated
      } else {
        const fileName = path.split(/[\\/]/).pop() || "untitled"
        const languageType = getLanguageFromPath(path)
        const newTab: EditorTab = {
          id: `tab-${Date.now()}-${Math.random()}`,
          path,
          name: fileName,
          content: newContent,
          modified: true,
          language: languageType,
        }
        setActiveTabId(newTab.id)
        return [...prev, newTab]
      }
    })
  }

  const handleCursorPositionChange = useCallback((line: number, column: number) => {
    setCursorPosition({ line, column })
  }, [])

  const handleTabReorder = (fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const newTabs = [...prev]
      const [movedTab] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, movedTab)
      return newTabs
    })
  }

  const handleTabMoveToStart = (index: number) => {
    setTabs((prev) => {
      const newTabs = [...prev]
      const [movedTab] = newTabs.splice(index, 1)
      newTabs.unshift(movedTab)
      return newTabs
    })
  }

  const handleTabMoveToEnd = (index: number) => {
    setTabs((prev) => {
      const newTabs = [...prev]
      const [movedTab] = newTabs.splice(index, 1)
      newTabs.push(movedTab)
      return newTabs
    })
  }

  const handleTabCloseOthers = (tabId: string) => {
    setTabs((prev) => prev.filter((tab) => tab.id === tabId))
    setActiveTabId(tabId)
  }

  const handleTabToggleViewMode = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (tab && tab.path.endsWith(".adofai")) {
      const newMode = tab.editorViewMode === "design" ? "source" : "design"
      handleFileSelect(tab.path, newMode)
    }
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  useEffect(() => {
    if (activeTab) {
      document.title = `${activeTab.name} - ADOFAI Studio`
    } else {
      document.title = "ADOFAI Studio"
    }
  }, [activeTab])

  if (!isElectron) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--background)]">
        <div className="text-center max-w-md p-8 bg-[var(--menu-background)] rounded-lg border border-[var(--border)] shadow-xl">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">ADOFAI Studio</h1>
          <p className="text-[var(--foreground)] opacity-60 mb-6">
            This application requires Electron to run properly. The file system features are not available in the
            browser preview.
          </p>
          <div className="bg-[var(--background)] p-4 rounded-lg text-left text-sm border border-[var(--border)]">
            <p className="font-semibold text-[var(--foreground)] mb-2">To run this app:</p>
            <ol className="list-decimal list-inside space-y-1 text-[var(--foreground)] opacity-60">
              <li>Download the ZIP file</li>
              <li>Extract and open in terminal</li>
              <li>Run: npm install</li>
              <li>Run: npm run dev</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <TitleBar title={activeTab ? `${activeTab.name} - ADOFAI Studio` : "ADOFAI Studio"}>
        <MenuBar
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
        onThemeChange={setTheme}
        externalLangsLoaded={externalLangsLoaded}
        onOpenFolder={handleOpenFolder}
          onOpenFile={handleOpenFile}
          onSave={() => activeTab && handleSave(activeTab.id, activeTab.content)}
          onSaveAll={handleSaveAll}
          onClose={() => activeTabId && handleTabClose(activeTabId)}
          onCloseAll={() => {
            tabs.forEach(t => handleTabClose(t.id))
          }}
          onUndo={() => editorPaneRef.current?.undo()}
          onRedo={() => editorPaneRef.current?.redo()}
          onCut={() => editorPaneRef.current?.cut()}
          onCopy={() => editorPaneRef.current?.copy()}
          onPaste={() => editorPaneRef.current?.paste()}
          onFind={() => editorPaneRef.current?.find()}
          onReplace={() => editorPaneRef.current?.replace()}
          onSelectAll={() => editorPaneRef.current?.selectAll()}
          embedded
        />
      </TitleBar>

      <div className="flex-1 flex overflow-hidden">
          <div style={{ width: isExplorerCollapsed ? 48 : explorerWidth }} className="shrink-0 transition-all duration-300">
            <FileExplorer
              onFileSelect={handleFileSelect}
              selectedFile={activeTab?.path || null}
              language={language}
              theme={theme}
              rootPath={rootPath}
              onRootPathChange={setRootPath}
              isCollapsed={isExplorerCollapsed}
              onToggleCollapse={setIsExplorerCollapsed}
              onTransformFile={handleTransformFile}
            />
          </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={setActiveTabId}
            onTabClose={handleTabClose}
            onTabReorder={handleTabReorder}
            onTabMoveToStart={handleTabMoveToStart}
            onTabMoveToEnd={handleTabMoveToEnd}
            onTabCloseOthers={handleTabCloseOthers}
            onTabToggleViewMode={handleTabToggleViewMode}
            language={language}
          />

          <div className="flex-1 min-h-0">
            <EditorPane
              ref={editorPaneRef}
              tab={activeTab || null}
              onContentChange={handleContentChange}
              onSave={handleSave}
              onSaveAll={handleSaveAll}
              onCursorPositionChange={handleCursorPositionChange}
              language={language}
              theme={theme}
            />
          </div>
        </div>
      </div>

      <StatusBar
        language={language}
        onLanguageChange={setLanguage}
        activeFilePath={activeTab?.path}
        lineNumber={cursorPosition.line}
        columnNumber={cursorPosition.column}
      />
    </div>
  )
}

export default App
