"use client"

import { useState, useEffect, useMemo } from "react"
import { Level } from "adofai"
import StringParser from "../lib/StringParser"
import exportAsADOFAI from "../lib/format"
import { useTranslation, type Language } from "../lib/i18n"
import { HexColorPicker } from "react-colorful"
import {
  Info,
  Music,
  Layout,
  Image as ImageIcon,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  Palette,
  Clock,
  User,
  Tag,
} from "lucide-react"

interface DesignViewProps {
  content: string
  onChange: (newContent: string) => void
  theme?: string
  language?: Language
}

export function DesignView({ content, onChange, theme, language = "en" }: DesignViewProps) {
  const { t } = useTranslation(language)
  const [levelData, setLevelData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<string>("levelSettings")
  const [activeCategory, setActiveCategory] = useState<string>("general")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    general: true,
    audio: true,
    track: true,
    background: true,
    advanced: false,
  })

  // Parse level data when content changes from outside
  useEffect(() => {
    if (!content) return
    
    let isMounted = true
    
    const loadLevel = async () => {
      try {
        const parser = new StringParser()
        const level = new Level(content, parser)
        
        // Level loading is asynchronous
        await new Promise<void>((resolve) => {
          level.on("load", () => resolve())
          level.load()
        })

        if (!isMounted) return

        if (level && level.settings) {
          try {
            const settingsJson = JSON.stringify(level.settings)
            if (settingsJson && settingsJson !== "undefined") {
              setLevelData(JSON.parse(settingsJson))
            } else {
              setLevelData({ ...level.settings })
            }
          } catch (stringifyError) {
            console.warn("Could not deep clone settings, using shallow clone", stringifyError)
            setLevelData({ ...level.settings })
          }
        }
      } catch (e) {
        console.error("Failed to parse level for design view", e)
      }
    }

    loadLevel()
    
    return () => {
      isMounted = false
    }
  }, [content])

  const handleSettingChange = (key: string, value: any) => {
    const newData = { ...levelData, [key]: value }
    setLevelData(newData)

    // Sync back to source
    try {
      const parser = new StringParser()
      const parsed = parser.parse(content)
      if (parsed) {
        parsed.settings = newData
        const newContent = exportAsADOFAI(parsed, 0, true)
        onChange(newContent)
      }
    } catch (e) {
      console.error("Failed to sync design view to source", e)
    }
  }

  const categories = [
    { id: "general", name: t("categoryGeneral"), icon: <Info size={16} />, keys: ["version", "artist", "specialArtistType", "artistPermission", "song", "author", "levelDesc", "levelTags", "artistLinks", "difficulty", "seizureWarning", "requiredMods", "songURL", "speedTrialAim"] },
    { id: "audio", name: t("categoryAudio"), icon: <Music size={16} />, keys: ["songFilename", "bpm", "volume", "offset", "pitch", "hitsound", "hitsoundVolume", "previewSongStart", "previewSongDuration", "separateCountdownTime", "countdownTicks"] },
    { id: "track", name: t("categoryTrack"), icon: <Layout size={16} />, keys: ["tileShape", "trackColorType", "trackColor", "secondaryTrackColor", "trackColorAnimDuration", "trackColorPulse", "trackPulseLength", "trackStyle", "trackTexture", "trackTextureScale", "trackGlowIntensity", "trackAnimation", "beatsAhead", "trackDisappearAnimation", "beatsBehind", "stickToFloors", "planetEase", "planetEaseParts", "planetEasePartBehavior"] },
    { id: "background", name: t("categoryBackground"), icon: <ImageIcon size={16} />, keys: ["backgroundColor", "showDefaultBGIfNoImage", "showDefaultBGTile", "defaultBGTileColor", "defaultBGShapeType", "defaultBGShapeColor", "bgImage", "bgImageColor", "parallax", "bgDisplayMode", "imageSmoothing", "lockRot", "loopBG", "scalingRatio", "relativeTo", "position", "rotation", "zoom", "bgVideo", "loopVideo", "vidOffset"] },
    { id: "ui", name: t("categoryUI"), icon: <Palette size={16} />, keys: ["previewImage", "previewIcon", "previewIconColor", "floorIconOutlines", "customClass", "defaultTextColor", "defaultTextShadowColor", "congratsText", "perfectText", "pulseOnFloor", "startCamLowVFX"] },
    { id: "advanced", name: t("categoryAdvanced"), icon: <SettingsIcon size={16} />, keys: ["legacyFlash", "legacyCamRelativeTo", "legacySpriteTiles", "legacyTween", "angleData", "pathData"] },
  ]

  const tabs = [
    { id: "levelSettings", name: t("levelSettings"), icon: <SettingsIcon size={16} /> },
    { id: "visualEditor", name: t("visualEditor"), icon: <Layout size={16} /> },
    { id: "eventList", name: t("eventList"), icon: <Clock size={16} /> },
  ]

  if (!levelData) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--foreground)] opacity-50">
        {t("loadingDesignView")}
      </div>
    )
  }

  const renderSettingInput = (key: string) => {
    const value = levelData[key]
    const type = typeof value

    const isColorKey = key.toLowerCase().includes("color") || 
                       ["trackColor", "secondaryTrackColor", "backgroundColor", "bgImageColor", "previewIconColor", "defaultTextColor", "defaultTextShadowColor"].includes(key)

    if (key === "version") {
      return (
        <input
          type="number"
          value={value}
          disabled
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] opacity-50 cursor-not-allowed"
        />
      )
    }

    if (isColorKey) {
      const colorValue = String(value || "")
      const displayColor = colorValue.startsWith("#") ? colorValue : (colorValue ? `#${colorValue.substring(0, 6)}` : "#ffffff")
      
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer" 
              style={{ backgroundColor: displayColor }}
            />
            <input
              type="text"
              value={colorValue}
              onChange={(e) => handleSettingChange(key, e.target.value)}
              className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)]"
            />
          </div>
          <div className="mt-1">
            <HexColorPicker 
              color={displayColor.startsWith("#") && (displayColor.length === 4 || displayColor.length === 7) ? displayColor : "#ffffff"} 
              onChange={(color) => handleSettingChange(key, color.replace("#", ""))} 
            />
          </div>
        </div>
      )
    }

    if (type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => handleSettingChange(key, e.target.checked)}
          className="w-4 h-4 accent-[var(--accent)]"
        />
      )
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex gap-2">
          {value.map((v, i) => (
            <input
              key={i}
              type="number"
              value={v}
              onChange={(e) => {
                const newArr = [...value]
                newArr[i] = Number(e.target.value)
                handleSettingChange(key, newArr)
              }}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)]"
            />
          ))}
        </div>
      )
    }

    if (type === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleSettingChange(key, Number(e.target.value))}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)]"
        />
      )
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleSettingChange(key, e.target.value)}
        className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)]"
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--editor-background)] overflow-hidden">
      {/* Summary Pane */}
      <div className="p-6 border-b border-[var(--border)] bg-[var(--menu-background)] shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-[var(--foreground)] truncate">
                {levelData.artist || t("unknownArtist")} - {levelData.song || t("unknownSong")}
              </h2>
              <div className="px-2 py-0.5 rounded bg-[var(--accent)] text-white text-[10px] font-bold tracking-wider">
                v{levelData.version}
              </div>
            </div>
            
            {levelData.author && (
              <div className="flex items-center gap-1.5 text-[var(--foreground)] opacity-60 text-sm mb-3">
                <User size={14} />
                <span>{levelData.author.replace(/[,，&]/g, " & ")}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-2 bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                <Clock size={14} className="text-[var(--accent)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-50 font-bold leading-none mb-0.5">{t("offset")}</span>
                  <span className="text-sm font-mono leading-none">{levelData.offset}ms</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                <Music size={14} className="text-[var(--accent)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-50 font-bold leading-none mb-0.5">BPM</span>
                  <span className="text-sm font-mono leading-none">{levelData.bpm}</span>
                </div>
              </div>

              {levelData.levelTags && (
                <div className="flex items-center gap-2 bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--border)] max-w-xs">
                  <Tag size={14} className="text-[var(--accent)]" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] opacity-50 font-bold leading-none mb-0.5">{t("tags")}</span>
                    <span className="text-sm truncate leading-none">{levelData.levelTags.split(",").join(", ")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>

    {/* Sub Tabs */}
    <div className="flex items-center px-6 bg-[var(--menu-background)] border-b border-[var(--border)] shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors relative ${
            activeTab === tab.id
              ? "text-[var(--accent)]"
              : "text-[var(--foreground)] opacity-60 hover:opacity-100"
          }`}
        >
          {tab.icon}
          {tab.name}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          )}
        </button>
      ))}
    </div>

    {/* Content Area */}
    <div className="flex-1 overflow-hidden relative">
      {activeTab === "levelSettings" && (
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent">
          <div className="max-w-4xl mx-auto space-y-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-[var(--menu-background)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--hover)] transition-colors border-b border-[var(--border)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                      {category.icon}
                    </div>
                    <span className="font-semibold text-[var(--foreground)]">{category.name}</span>
                  </div>
                  {expandedCategories[category.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>

                {expandedCategories[category.id] && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {category.keys.map((key) => (
                      levelData[key] !== undefined && (
                        <div key={key} className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-[var(--foreground)] opacity-50 tracking-wider">
                            {t(key)}
                          </label>
                          {renderSettingInput(key)}
                          {key === "version" && (
                            <div className="text-[10px] text-[var(--foreground)] opacity-50 whitespace-pre-line mt-0.5">
                              {t("versionDisabledWarning")}
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "visualEditor" && (
        <div className="h-full flex flex-col items-center justify-center text-[var(--foreground)] opacity-40 italic">
          <Layout size={48} className="mb-4" />
          <p>{t("visualEditor")} - Coming Soon</p>
        </div>
      )}

      {activeTab === "eventList" && (
        <div className="h-full flex flex-col items-center justify-center text-[var(--foreground)] opacity-40 italic">
          <Clock size={48} className="mb-4" />
          <p>{t("eventList")} - Coming Soon</p>
        </div>
      )}
    </div>
  </div>
)
}
