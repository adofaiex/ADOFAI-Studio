"use client"

import { useEffect, useRef, useState } from "react"
import Editor from "@monaco-editor/react"
import { FileText, Music, Play, Pause, Volume2, SkipBack, SkipForward } from "lucide-react"
import type { EditorTab } from "../types/file-system"
import type { Language } from "../lib/i18n"
import adofaiSchema from "../lib/adofai-schema.json"
import exportAsADOFAI from "../lib/format"
import StringParser from "../lib/StringParser"
import { useTranslation } from "../lib/i18n"

import { Level } from "adofai"

interface EditorPaneProps {
  tab: EditorTab | null
  onContentChange: (tabId: string, content: string, modified: boolean) => void
  onSave: (tabId: string, content: string) => void
  onSaveAll?: () => void
  onCursorPositionChange?: (line: number, column: number) => void
  language?: Language
}

export function EditorPane({
  tab,
  onContentChange,
  onSave,
  onSaveAll,
  onCursorPositionChange,
  language = "en",
}: EditorPaneProps) {
  const t = useTranslation(language)
  const [isSaving, setIsSaving] = useState(false)
  const [isImage, setIsImage] = useState(false)
  const [isAudio, setIsAudio] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string>("")
  const [audioDataUrl, setAudioDataUrl] = useState<string>("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const initialContentRef = useRef<string>("")
  const registeredProvidersRef = useRef<any[]>([])

  useEffect(() => {
    if (tab) {
      initialContentRef.current = tab.content
      const isImageFile = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(tab.path)
      const isAudioFile = /\.(mp3|wav|ogg|flac|m4a)$/i.test(tab.path)
      setIsImage(isImageFile)
      setIsAudio(isAudioFile)

      if (isImageFile) {
        window.electronAPI.readFileAsBase64(tab.path).then((dataUrl) => {
          setImageDataUrl(dataUrl)
        })
      } else if (isAudioFile) {
        // Reset state
        setIsPlaying(false)
        setCurrentTime(0)
        setDuration(0)

        window.electronAPI.readFileAsBase64(tab.path).then((base64) => {
          const ext = tab.path.split(".").pop()?.toLowerCase() || ""
          let mimeType = "audio/mpeg"
          if (ext === "wav") mimeType = "audio/wav"
          else if (ext === "ogg") mimeType = "audio/ogg"
          else if (ext === "flac") mimeType = "audio/flac"
          else if (ext === "m4a") mimeType = "audio/mp4"

          // Force replace incorrect data:application/octet-stream if present
          let dataUrl = base64
          if (base64.startsWith("data:application/octet-stream")) {
            dataUrl = base64.replace("data:application/octet-stream", `data:${mimeType}`)
          } else if (!base64.startsWith("data:")) {
            dataUrl = `data:${mimeType};base64,${base64}`
          }
          setAudioDataUrl(dataUrl)
        })
      }
    }
  }, [tab])

  useEffect(() => {
    if (isAudio && audioDataUrl && audioRef.current) {
      const audio = audioRef.current

      const handleLoadedMetadata = () => {
        setDuration(audio.duration)
      }

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime)
      }

      const handleEnded = () => {
        setIsPlaying(false)
      }

      audio.addEventListener("loadedmetadata", handleLoadedMetadata)
      audio.addEventListener("timeupdate", handleTimeUpdate)
      audio.addEventListener("ended", handleEnded)

      // Initialize Web Audio API for waveform
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
        sourceRef.current = audioContextRef.current.createMediaElementSource(audio)
        sourceRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioContextRef.current.destination)
      }

      const drawWaveform = () => {
        if (!canvasRef.current || !analyserRef.current) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const analyser = analyserRef.current
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const render = () => {
          animationFrameRef.current = requestAnimationFrame(render)
          analyser.getByteFrequencyData(dataArray)

          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const barWidth = (canvas.width / bufferLength) * 2.5
          let x = 0

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height
            const opacity = dataArray[i] / 255

            ctx.fillStyle = `rgba(60, 125, 214, ${0.3 + opacity * 0.7})`
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

            x += barWidth + 1
          }
        }
        render()
      }

      drawWaveform()

      return () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
        audio.removeEventListener("timeupdate", handleTimeUpdate)
        audio.removeEventListener("ended", handleEnded)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isAudio, audioDataUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume()
      }
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value)
    setVolume(value)
    if (audioRef.current) {
      audioRef.current.volume = value
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = value
      setCurrentTime(value)
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00"
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleSave = async () => {
    if (!tab || !editorRef.current) return

    setIsSaving(true)
    try {
      const currentContent = editorRef.current.getValue()
      await window.electronAPI.writeFile(tab.path, currentContent)
      initialContentRef.current = currentContent
      onSave(tab.id, currentContent)
    } catch (error) {
      console.error("Failed to save file:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (!tab || value === undefined) return
    const modified = value !== initialContentRef.current
    onContentChange(tab.id, value, modified)
  }

  const handleFormatAsADOFAI = () => {
    if (!tab || !editorRef.current || !tab.path.endsWith(".adofai")) return

    try {
      const currentContent = editorRef.current.getValue()
      const parser = new StringParser()
      const parsed = parser.parse(currentContent)
      const formatted = exportAsADOFAI(parsed, 0, true)

      const model = editorRef.current.getModel()
      if (model) {
        model.pushStackElement()
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ],
          () => null
        )
        model.pushStackElement()
      }
    } catch (error) {
      console.error("Failed to format as ADOFAI:", error)
    }
  }

  const handleClearEffect = async () => {
    if (!tab || !editorRef.current || !tab.path.endsWith(".adofai")) return

    try {
      const currentContent = editorRef.current.getValue()
      const parser = new StringParser()

      // Preset options
      const presetOptions = [
        "preset_noeffect",
        "preset_noholds(Experimental)",
        "preset_nomovecamera",
        "preset_noeffect_completely",
      ]

      // Simple select prompt
      const presetName = window.prompt("Select Preset:\n" + presetOptions.join("\n"), presetOptions[0])
      if (!presetName || !presetOptions.includes(presetName)) return

      const level = new Level(currentContent, parser)
      await new Promise<void>((resolve) => {
        level.on("load", () => resolve())
        level.load()
      })

      const presets: Record<string, any> = {
        preset_noeffect: {
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
        },
        "preset_noholds(Experimental)": { type: "exclude", events: ["Hold"] },
        preset_nomovecamera: { type: "exclude", events: ["MoveCamera"] },
        preset_noeffect_completely: {
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
        },
      }

      const preset = presets[presetName]
      ;(level as any).clearEvent(preset)
      const output = (level as any).export()

      const model = editorRef.current.getModel()
      if (model) {
        model.pushStackElement()
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: output,
            },
          ],
          () => null
        )
        model.pushStackElement()
      }
      handleEditorChange(output) // Mark as modified and allow undo
    } catch (error) {
      console.error("Failed to clear effects:", error)
      alert("Failed to clear effects: " + error)
    }
  }

  const handleClearDeco = async () => {
    if (!tab || !editorRef.current || !tab.path.endsWith(".adofai")) return

    try {
      const currentContent = editorRef.current.getValue()
      const parser = new StringParser()
      const level = new Level(currentContent, parser)
      await new Promise<void>((resolve) => {
        level.on("load", () => resolve())
        level.load()
      })

      ;(level as any).clearDeco()
      const output = (level as any).export()

      const model = editorRef.current.getModel()
      if (model) {
        model.pushStackElement()
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: output,
            },
          ],
          () => null
        )
        model.pushStackElement()
      }
      handleEditorChange(output) // Mark as modified and allow undo
    } catch (error) {
      console.error("Failed to clear decorations:", error)
      alert("Failed to clear decorations: " + error)
    }
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorPositionChange) {
        onCursorPositionChange(e.position.lineNumber, e.position.column)
      }
    })

    // Ctrl+S for Save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })

    // Ctrl+Shift+S for Save All
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      if (onSaveAll) {
        onSaveAll()
      }
    })

    if (tab?.path.endsWith(".adofai")) {
      editor.addAction({
        id: "format-as-adofai",
        label: "Format as ADOFAI Standard Level",
        contextMenuGroupId: "modification",
        contextMenuOrder: 1.5,
        run: handleFormatAsADOFAI,
      })

      editor.addAction({
        id: "clear-effect",
        label: "Clear Effect",
        contextMenuGroupId: "modification",
        contextMenuOrder: 1.6,
        run: handleClearEffect,
      })

      editor.addAction({
        id: "clear-deco",
        label: "Clear Decorations",
        contextMenuGroupId: "modification",
        contextMenuOrder: 1.7,
        run: handleClearDeco,
      })

      registerADOFAIHints(monaco)
    }
  }

  // No Monaco i18n overrides; keep default English UI for stability

  const registerADOFAIHints = (monaco: any) => {
    registeredProvidersRef.current.forEach((disposable) => disposable.dispose())
    registeredProvidersRef.current = []

    const completionProvider = monaco.languages.registerCompletionItemProvider("json", {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const suggestions = Object.entries(adofaiSchema.comment).map(([key, value]: [string, any]) => {
          const description = (value as any)[language] || value.en
          return {
            label: key,
            kind: monaco.languages.CompletionItemKind.Property,
            documentation: description,
            insertText: `"${key}": `,
            range: range,
          }
        })

        return { suggestions }
      },
    })

    const hoverProvider = monaco.languages.registerHoverProvider("json", {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null

        const fieldName = word.word.replace(/"/g, "")
        const fieldData = adofaiSchema.comment[fieldName as keyof typeof adofaiSchema.comment]
  
        if (fieldData) {
          const description = (fieldData as any)[language] || (fieldData as any).en
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [{ value: `**${fieldName}**` }, { value: description }],
          }
        }

        return null
      },
    })

    registeredProvidersRef.current.push(completionProvider, hoverProvider)
  }

  useEffect(() => {
    if (monacoRef.current && tab?.path.endsWith(".adofai")) {
      registerADOFAIHints(monacoRef.current)
    }
  }, [language, tab?.path])

  useEffect(() => {
    return () => {
      registeredProvidersRef.current.forEach((disposable) => disposable.dispose())
      registeredProvidersRef.current = []
    }
  }, [])

  if (!tab) {
    return (
      <div className="h-full bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <FileText size={64} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No file selected</p>
          <p className="text-sm mt-2">Open a file from the Solution Explorer</p>
        </div>
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 min-h-0">
            <div className="flex-1 flex items-center justify-center min-h-0 w-full">
              <img
                src={imageDataUrl || "/placeholder.svg"}
                alt={tab.name}
                className="max-w-full max-h-full object-contain rounded shadow-lg"
                style={{ imageRendering: "auto" }}
              />
            </div>
            <div className="text-zinc-400 text-sm shrink-0">{tab.name} - Image Preview</div>
          </div>
        </div>
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <div className="w-full max-w-2xl bg-[#2b2b2b] rounded-2xl border border-[#3c3c3c] shadow-2xl overflow-hidden flex flex-col">
            {/* Visualizer Header */}
            <div className="h-48 bg-[#1a1a1a] relative flex items-end px-1">
              <canvas ref={canvasRef} width={800} height={180} className="w-full h-full opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2b2b2b] to-transparent pointer-events-none" />
              <div className="absolute top-6 left-8 flex items-center gap-4">
                <div className="w-16 h-16 bg-[#3c7dd6] rounded-xl flex items-center justify-center shadow-lg shadow-[#3c7dd6]/20">
                  <Music size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1 truncate max-w-md">{tab.name}</h3>
                  <p className="text-zinc-500 text-sm font-medium tracking-wide uppercase">Audio Preview</p>
                </div>
              </div>
            </div>

            {/* Controls Section */}
            <div className="p-8 flex flex-col gap-6">
              {/* Progress Bar */}
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.01"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-[#3c3c3c] rounded-lg appearance-none cursor-pointer accent-[#3c7dd6] hover:accent-[#4a8ce7] transition-all"
                />
                <div className="flex justify-between text-[11px] font-mono text-zinc-500 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                    <SkipBack size={20} />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 bg-[#3c7dd6] hover:bg-[#4a8ce7] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#3c7dd6]/20 transition-all hover:scale-105 active:scale-95"
                  >
                    {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} className="ml-1" fill="currentColor" />}
                  </button>
                  <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                    <SkipForward size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-3 bg-[#333333] px-4 py-2 rounded-full">
                  <Volume2 size={18} className="text-zinc-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-[#454545] rounded-lg appearance-none cursor-pointer accent-zinc-300"
                  />
                </div>
              </div>
            </div>
          </div>
          <audio ref={audioRef} src={audioDataUrl} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="flex-1">
        <Editor
          theme="vs-dark"
          language={tab.language}
          value={tab.content}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: "on",
            fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
            fontLigatures: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: "on",
            snippetSuggestions: "inline",
          }}
        />
      </div>
    </div>
  )
}
