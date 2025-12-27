"use client"

import React from "react"
import { type Language, useTranslation, translations } from "../lib/i18n"
import type { ThemeType } from "../types/theme"

interface MenuBarProps {
  language: Language
  onLanguageChange: (lang: Language) => void
  theme: ThemeType
  onThemeChange: (theme: ThemeType) => void
  onOpenFolder: () => void
  onOpenFile: () => void
  onSave: () => void
  onSaveAll: () => void
  onClose?: () => void
  onCloseAll?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onCut?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onFind?: () => void
  onReplace?: () => void
  onSelectAll?: () => void
  embedded?: boolean
  externalLangsLoaded?: boolean
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
  theme,
  onThemeChange,
  onOpenFolder,
  onOpenFile,
  onSave,
  onSaveAll,
  onClose,
  onCloseAll,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onReplace,
  onSelectAll,
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
        { label: t.close, action: onClose, shortcut: "Ctrl+W" },
        { label: t.closeAll, action: onCloseAll, shortcut: "Ctrl+K W" },
      ],
    },
    {
      id: "edit",
      label: t.edit,
      items: [
        { label: t.undo, action: onUndo, shortcut: "Ctrl+Z" },
        { label: t.redo, action: onRedo, shortcut: "Ctrl+Y" },
        { type: "separator" },
        { label: t.cut, action: onCut, shortcut: "Ctrl+X" },
        { label: t.copy, action: onCopy, shortcut: "Ctrl+C" },
        { label: t.paste, action: onPaste, shortcut: "Ctrl+V" },
        { type: "separator" },
        { label: t.find, action: onFind, shortcut: "Ctrl+F" },
        { label: t.replace, action: onReplace, shortcut: "Ctrl+H" },
      ],
    },
    {
      id: "selection",
      label: t.selection,
      items: [{ label: t.selectAll, action: onSelectAll, shortcut: "Ctrl+A" }],
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
          submenu: Object.keys(translations).map((langCode) => ({
            label: translations[langCode].languageName || langCode,
            action: () => onLanguageChange(langCode),
          })),
        },
        {
          label: t.theme,
          submenu: [
            { label: t.themeDark, action: () => onThemeChange("dark") },
            { label: t.themeLight, action: () => onThemeChange("light") },
            { label: t.themeHighContrast, action: () => onThemeChange("high-contrast") },
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
    <div className={`flex items-center bg-[var(--menu-background)] text-xs select-none relative z-50 ${embedded ? "h-8 px-0" : "h-8 border-b border-[var(--border)] px-2"}`}>
      {menus.map((menu) => (
        <div key={menu.id} className="relative h-full">
          <button
            className={`px-3 h-full hover:bg-[var(--hover)] transition-colors ${
              activeMenu === menu.id ? "bg-[var(--hover)]" : ""
            }`}
            onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
            onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
          >
            {menu.label}
          </button>

          {activeMenu === menu.id && (
            <div className="absolute top-full left-0 w-64 bg-[var(--menu-background)] border border-[var(--border)] shadow-xl py-1 animate-in fade-in zoom-in duration-75">
              {menu.items.map((item, idx) => (
                <div key={idx} className="relative group/sub">
                  {item.type === "separator" ? (
                    <div className="h-px bg-[var(--border)] my-1 mx-2" />
                  ) : (
                    <button
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--accent)] hover:text-white group transition-colors"
                      onClick={() => {
                        if (!item.submenu) {
                          item.action?.()
                          setActiveMenu(null)
                        }
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-zinc-500 group-hover:text-zinc-200">{item.shortcut}</span>
                      )}
                      {item.submenu && <span className="text-[10px] opacity-60">▶</span>}
                    </button>
                  )}

                  {item.submenu && (
                    <div className="absolute left-full top-0 w-48 bg-[var(--menu-background)] border border-[var(--border)] shadow-xl py-1 hidden group-hover/sub:block animate-in slide-in-from-left-1 duration-75">
                      {item.submenu.map((subItem, subIdx) => (
                        <button
                          key={subIdx}
                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--accent)] hover:text-white transition-colors"
                          onClick={() => {
                            subItem.action?.()
                            setActiveMenu(null)
                          }}
                        >
                          {subItem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {activeMenu && <div className="fixed inset-0 z-[-1]" onClick={() => setActiveMenu(null)} />}
    </div>
  )
}
