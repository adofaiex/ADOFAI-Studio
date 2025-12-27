"use client"

import React from "react"
import { type Language, useTranslation } from "../lib/i18n"

interface MenuBarProps {
  language: Language
  onLanguageChange: (lang: Language) => void
  onOpenFolder: () => void
  onOpenFile: () => void
  onSave: () => void
  onSaveAll: () => void
  embedded?: boolean
}

interface MenuItem {
  label?: string
  action?: () => void
  shortcut?: string
  type?: "separator"
  submenu?: MenuItem[]
}

interface Menu {
  id: string
  label: string
  items: MenuItem[]
}

export function MenuBar({
  language,
  onLanguageChange,
  onOpenFolder,
  onOpenFile,
  onSave,
  onSaveAll,
  embedded = false,
}: MenuBarProps) {
  const t = useTranslation(language)
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null)

  const menus: Menu[] = [
    {
      id: "file",
      label: t.file,
      items: [
        { label: t.openFolder, action: onOpenFolder, shortcut: "Ctrl+K Ctrl+O" },
        { label: t.openFile, action: onOpenFile, shortcut: "Ctrl+O" },
        { type: "separator" },
        { label: t.save, action: onSave, shortcut: "Ctrl+S" },
        { label: t.saveAll, action: onSaveAll, shortcut: "Ctrl+K S" },
        { type: "separator" },
        { label: t.close, shortcut: "Ctrl+W" },
        { label: t.closeAll, shortcut: "Ctrl+K W" },
      ],
    },
    {
      id: "edit",
      label: t.edit,
      items: [
        { label: t.undo, shortcut: "Ctrl+Z" },
        { label: t.redo, shortcut: "Ctrl+Y" },
        { type: "separator" },
        { label: t.cut, shortcut: "Ctrl+X" },
        { label: t.copy, shortcut: "Ctrl+C" },
        { label: t.paste, shortcut: "Ctrl+V" },
        { type: "separator" },
        { label: t.find, shortcut: "Ctrl+F" },
        { label: t.replace, shortcut: "Ctrl+H" },
      ],
    },
    {
      id: "selection",
      label: t.selection,
      items: [{ label: t.selectAll, shortcut: "Ctrl+A" }],
    },
    {
      id: "view",
      label: t.view,
      items: [],
    },
    {
      id: "go",
      label: t.go,
      items: [],
    },
    {
      id: "options",
      label: t.options,
      items: [
        {
          label: t.language,
          submenu: [
            { label: t.english, action: () => onLanguageChange("en") },
            { label: t.chinese, action: () => onLanguageChange("zh") },
            { label: t.korean, action: () => onLanguageChange("ko") },
          ],
        },
      ],
    },
    {
      id: "help",
      label: t.help,
      items: [],
    },
  ]

  return (
    <div
      className={
        embedded
          ? "h-8 flex items-center px-0 text-xs select-none"
          : "h-8 bg-[#3c3c3c] border-b border-[#2b2b2b] flex items-center px-2 text-xs select-none"
      }
    >
      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            className={`px-2.5 py-1.5 ${embedded ? "hover:bg-[#3c3c3c]" : "hover:bg-[#4c4c4c]"} rounded transition-colors ${
              activeMenu === menu.id ? "bg-[#4c4c4c]" : ""
            }`}
            onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
            onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
          >
            {menu.label}
          </button>
          {activeMenu === menu.id && menu.items.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
              <div className="absolute top-full left-0 mt-0.5 bg-[#2b2b2b] border border-[#454545] rounded shadow-xl z-20 min-w-[220px] py-1">
                {menu.items.map((item, idx) => {
                  if (item.type === "separator") {
                    return <div key={idx} className="h-px bg-[#454545] my-1 mx-2" />
                  }
                  if (item.submenu) {
                    return (
                      <div key={idx} className="relative group">
                        <div className="w-full px-3 py-1.5 hover:bg-[#3c7dd6] hover:text-white flex items-center justify-between text-left transition-colors">
                          <span>{item.label}</span>
                          <span className="ml-8">›</span>
                        </div>
                        <div className="hidden group-hover:block absolute left-full top-0 ml-1 bg-[#2b2b2b] border border-[#454545] rounded shadow-xl min-w-[160px] py-1">
                          {item.submenu.map((subitem, subidx) => (
                            <button
                              key={subidx}
                              className="w-full px-3 py-1.5 hover:bg-[#3c7dd6] hover:text-white text-left transition-colors"
                              onClick={() => {
                                subitem.action?.()
                                setActiveMenu(null)
                              }}
                            >
                              {subitem.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <button
                      key={idx}
                      className="w-full px-3 py-1.5 hover:bg-[#3c7dd6] hover:text-white flex items-center justify-between text-left transition-colors"
                      onClick={() => {
                        item.action?.()
                        setActiveMenu(null)
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="text-xs text-zinc-500 ml-8">{item.shortcut}</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
