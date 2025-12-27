"use client"

import { FileCode, GitBranch, CheckCircle } from "lucide-react"
import type { Language } from "../lib/i18n"

interface StatusBarProps {
  language: Language
  onLanguageChange: (lang: Language) => void
  activeFilePath?: string
  lineNumber?: number
  columnNumber?: number
}

export function StatusBar({
  language,
  onLanguageChange,
  activeFilePath,
  lineNumber = 1,
  columnNumber = 1,
}: StatusBarProps) {
  const languages: { value: Language; label: string }[] = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
    { value: "ko", label: "한국어" },
  ]

  const getFileType = (path?: string) => {
    if (!path) return ""
    if (path.endsWith(".adofai")) return "ADOFAI"
    if (path.endsWith(".json")) return "JSON"
    if (path.endsWith(".ts")) return "TypeScript"
    if (path.endsWith(".tsx")) return "TSX"
    if (path.endsWith(".js")) return "JavaScript"
    if (path.endsWith(".jsx")) return "JSX"
    if (path.endsWith(".md")) return "Markdown"
    return "Text"
  }

  return (
    <div className="h-6 bg-[#3c3c3c] border-t border-[#2b2b2b] flex items-center justify-between px-2 text-xs select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <GitBranch size={12} />
          <span>main</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <CheckCircle size={12} className="text-green-500" />
          <span>No issues</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {activeFilePath && (
          <>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <FileCode size={12} />
              <span>{getFileType(activeFilePath)}</span>
            </div>
            <div className="text-zinc-400">
              Ln {lineNumber}, Col {columnNumber}
            </div>
          </>
        )}
        <div className="relative group">
          <button className="px-2 py-0.5 hover:bg-[#4c4c4c] rounded transition-colors text-zinc-300">
            {languages.find((l) => l.value === language)?.label}
          </button>
          <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-[#2b2b2b] border border-[#454545] rounded shadow-lg overflow-hidden">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => onLanguageChange(lang.value)}
                className={`block w-full px-4 py-1.5 text-left hover:bg-[#3c3c3c] transition-colors ${
                  language === lang.value ? "bg-[#3c3c3c] text-white" : "text-zinc-300"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
