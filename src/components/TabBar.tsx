"use client"
import type { EditorTab } from "../types/file-system"
import type React from "react"

import { X, FileCode, Image, Music, FileText, MoreVertical } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useTranslation, type Language } from "../lib/i18n"

interface TabBarProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabReorder: (fromIndex: number, toIndex: number) => void
  onTabMoveToStart: (index: number) => void
  onTabMoveToEnd: (index: number) => void
  onTabCloseOthers: (tabId: string) => void
  onTabToggleViewMode: (tabId: string) => void
  language?: Language
}

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabReorder,
  onTabMoveToStart,
  onTabMoveToEnd,
  onTabCloseOthers,
  onTabToggleViewMode,
  language = "en",
}: TabBarProps) {
  const { t } = useTranslation(language)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string; index: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, tabId: string, index: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId, index })
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onTabReorder(draggedIndex, dragOverIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleDragEnd()
  }

  const truncateFileName = (name: string, maxLength = 20) => {
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

  return (
    <div className="h-9 bg-[var(--sidebar)] border-b border-[var(--border)] flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent select-none">
      {tabs.length === 0 ? (
        <div className="text-xs text-[var(--foreground)] opacity-50 px-4">No files open</div>
      ) : (
        tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            className={`group flex items-center gap-2 px-3 h-full cursor-pointer transition-colors relative min-w-[120px] max-w-[200px] border-r border-[var(--border)] ${
              activeTabId === tab.id
                ? "bg-[var(--tab-active)] text-[var(--foreground)]"
                : "bg-[var(--tab-inactive)] text-[var(--foreground)] opacity-60 hover:bg-[var(--hover)] hover:opacity-100"
            } ${dragOverIndex === index ? "border-l-2 border-[var(--accent)]" : ""}`}
            onClick={() => onTabClick(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id, index)}
          >
            {activeTabId === tab.id && <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--accent)]" />}
            <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
              <div className="shrink-0">
                {tab.path.endsWith(".adofai") ? (
                  <FileCode size={14} className="text-[var(--accent)]" />
                ) : /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(tab.path) ? (
                  <Image size={14} className={activeTabId === tab.id ? "text-[var(--foreground)] opacity-60" : ""} />
                ) : /\.(mp3|wav|ogg|flac|m4a)$/i.test(tab.path) ? (
                  <Music size={14} className={activeTabId === tab.id ? "text-[var(--foreground)] opacity-60" : ""} />
                ) : (
                  <FileText size={14} className={activeTabId === tab.id ? "text-[var(--foreground)] opacity-60" : ""} />
                )}
              </div>
              <span className={`text-[13px] truncate ${tab.modified ? "italic" : ""}`}>{tab.name}</span>
              {tab.modified && <div className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)] shrink-0 ml-1" />}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              className="p-0.5 rounded-md hover:bg-[var(--hover)] text-[var(--foreground)] opacity-0 group-hover:opacity-60 hover:opacity-100 transition-all shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[var(--menu-background)] border border-[var(--border)] rounded shadow-lg py-1 z-[2000] min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {tabs.find((t) => t.id === contextMenu.tabId)?.path.endsWith(".adofai") && (
            <>
              <button
                onClick={() => {
                  onTabToggleViewMode(contextMenu.tabId)
                  setContextMenu(null)
                }}
                className="w-full px-4 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors flex items-center justify-between"
              >
                <span>
                  {tabs.find((t) => t.id === contextMenu.tabId)?.editorViewMode === "design"
                    ? t("openSourceViewInNewTab")
                    : t("openDesignViewInNewTab")}
                </span>
              </button>
              <div className="h-px bg-[var(--border)] my-1" />
            </>
          )}
          <button
            onClick={() => {
              onTabMoveToStart(contextMenu.index)
              setContextMenu(null)
            }}
            className="w-full px-4 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t("moveToStart")}
          </button>
          <button
            onClick={() => {
              onTabMoveToEnd(contextMenu.index)
              setContextMenu(null)
            }}
            className="w-full px-4 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t("moveToEnd")}
          </button>
          <div className="h-px bg-[var(--border)] my-1" />
          <button
            onClick={() => {
              onTabClose(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full px-4 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t("close")}
          </button>
          <button
            onClick={() => {
              onTabCloseOthers(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full px-4 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t("closeOthers")}
          </button>
          <button
            onClick={() => {
              tabs.forEach((tab) => onTabClose(tab.id))
              setContextMenu(null)
            }}
            className="w-full px-4 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            {t.closeAll}
          </button>
        </div>
      )}
    </div>
  )
}
