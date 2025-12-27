"use client"

import { Minus, Square, Copy, X } from "lucide-react"
import asIcon from "../assets/icon.png"
import { useState, useEffect, type ReactNode } from "react"

interface TitleBarProps {
  title?: string
  children?: ReactNode
}

export function TitleBar({ title = "ADOFAI Studio", children }: TitleBarProps) {
  const [isElectron, setIsElectron] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && window.electronAPI !== undefined)
  }, [])

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI
      ?.windowIsMaximized?.()
      .then((val) => typeof val === "boolean" && setIsMaximized(val))
      .catch(() => {})
    const handler = (_event: unknown, val: boolean) => setIsMaximized(!!val)
    window.ipcRenderer?.on("window:maximized", handler)
    return () => {
      window.ipcRenderer?.off?.("window:maximized", handler as typeof handler)
    }
  }, [isElectron])

  const handleMinimize = () => {
    window.electronAPI?.windowMinimize()
  }

  const handleMaximize = () => {
    window.electronAPI?.windowMaximize()
  }

  const handleClose = () => {
    window.electronAPI?.windowClose()
  }

  if (!isElectron) return null

  return (
    <div className="h-8 bg-[var(--menu-background)] flex items-center justify-between pl-2 pr-0 select-none border-b border-[var(--border)] drag-region">
      <div className="flex items-center gap-2 no-drag">
        <img src={asIcon} alt="App Icon" className="w-4 h-4" />
        {children ? <>{children}</> : <div className="text-xs text-[var(--foreground)] opacity-60 font-medium">{title}</div>}
      </div>
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={handleMinimize}
          className="w-12 h-8 flex items-center justify-center hover:bg-[var(--hover)] transition-colors"
          title="Minimize"
        >
          <Minus size={14} className="text-[var(--foreground)] opacity-60" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-12 h-8 flex items-center justify-center hover:bg-[var(--hover)] transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy size={12} className="text-[var(--foreground)] opacity-60" /> : <Square size={12} className="text-[var(--foreground)] opacity-60" />}
        </button>
        <button
          onClick={handleClose}
          className="w-12 h-8 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <X size={16} className="text-[var(--foreground)] opacity-60 group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
