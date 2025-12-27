"use client"
import type { EditorTab } from "../types/file-system"
import type React from "react"

import { X, FileCode, Image, Music, FileText } from "lucide-react"
import { useState } from "react"

interface TabBarProps {
  tabs: EditorTab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabReorder: (fromIndex: number, toIndex: number) => void
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onTabReorder }: TabBarProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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
    <div className="h-9 bg-[#2b2b2b] border-b border-[#1e1e1e] flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-[#505050] scrollbar-track-transparent select-none">
      {tabs.length === 0 ? (
        <div className="text-xs text-zinc-500 px-4">No files open</div>
      ) : (
        tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            className={`group flex items-center gap-2 px-3 h-full cursor-pointer transition-colors relative min-w-[120px] max-w-[200px] border-r border-[#252526] ${
              activeTabId === tab.id ? "bg-[#1e1e1e] text-white" : "bg-[#2b2b2b] text-zinc-400 hover:bg-[#323233]"
            } ${dragOverIndex === index ? "border-l-2 border-[#3c7dd6]" : ""}`}
            onClick={() => onTabClick(tab.id)}
          >
            {activeTabId === tab.id && <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3c7dd6]" />}
            <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
              <div className="shrink-0">
                {tab.path.endsWith(".adofai") ? (
                  <FileCode size={14} className="text-[#3c7dd6]" />
                ) : /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(tab.path) ? (
                  <Image size={14} className="text-zinc-400" />
                ) : /\.(mp3|wav|ogg|flac|m4a)$/i.test(tab.path) ? (
                  <Music size={14} className="text-zinc-400" />
                ) : (
                  <FileText size={14} className="text-zinc-400" />
                )}
              </div>
              <span className={`text-[13px] truncate ${tab.modified ? "italic" : ""}`}>{tab.name}</span>
              {tab.modified && <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-1" />}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              className="p-0.5 rounded-md hover:bg-[#454545] text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  )
}
