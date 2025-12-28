import pathDataUtils from "./pathdata"

export interface LevelTransformResult {
  success: boolean
  content: string
  message?: string
}

function reorderLevel(levelObj: any, dataKey: "pathData" | "angleData"): any {
  const newObj: any = {}
  
  // 1. Data key first
  if (levelObj[dataKey] !== undefined) {
    newObj[dataKey] = levelObj[dataKey]
  } else if (dataKey === "angleData" && levelObj.pathData !== undefined) {
    // Should have been converted already, but just in case
    newObj.angleData = levelObj.angleData
  } else if (dataKey === "pathData" && levelObj.angleData !== undefined) {
    newObj.pathData = levelObj.pathData
  }

  // 2. settings second
  if (levelObj.settings !== undefined) {
    newObj.settings = levelObj.settings
  }

  // 3. everything else
  for (const key in levelObj) {
    if (key !== "pathData" && key !== "angleData" && key !== "settings") {
      newObj[key] = levelObj[key]
    }
  }

  return newObj
}

/**
 * Upgrade ADOFAI level to a newer version (15 or 16)
 * - pathData -> angleData
 * - "Enabled"/"Disabled" -> true/false
 * - Enable legacy features
 * - Version upgrade
 */
export function upgradeLevel(levelObj: any): LevelTransformResult {
  try {
    const settings = levelObj.settings || {}

    // 1. pathData (root or settings) -> angleData (root)
    const pathData = levelObj.pathData || settings.pathData
    if (pathData && !levelObj.angleData) {
      levelObj.angleData = pathDataUtils.parseToangleData(pathData)
      delete levelObj.pathData
      delete settings.pathData
    }

    // 2. Enabled/Disabled -> true/false
    const booleanKeys = [
      "separateCountdownTime", "seizureWarning", "showDefaultBGIfNoImage",
      "showDefaultBGTile", "imageSmoothing", "lockRot", "loopBG",
      "pulseOnFloor", "startCamLowVFX", "loopVideo", "floorIconOutlines",
      "stickToFloors", "legacyFlash", "legacyCamRelativeTo",
      "legacySpriteTiles", "legacyTween", "disableV15Features"
    ]

    for (const key of booleanKeys) {
      if (settings[key] === "Enabled") settings[key] = true
      if (settings[key] === "Disabled") settings[key] = false
    }

    // 3. Open legacy features
    settings.legacyFlash = true
    settings.legacyCamRelativeTo = true
    settings.legacySpriteTiles = true
    settings.legacyTween = true
    settings.disableV15Features = false

    // 4. Upgrade version
    const currentVersion = settings.version || 1
    if (currentVersion < 15) {
      settings.version = 15
    } else {
      settings.version = 16
    }

    // 5. Reorder
    const reordered = reorderLevel(levelObj, "angleData")

    return {
      success: true,
      content: JSON.stringify(reordered, null, "\t")
    }
  } catch (err) {
    return { success: false, content: "", message: String(err) }
  }
}

/**
 * Downgrade ADOFAI level to version 8
 * - angleData -> pathData (if compatible)
 * - true/false -> "Enabled"/"Disabled"
 * - Disable legacy features
 * - Version downgrade
 */
export function downgradeLevel(levelObj: any): LevelTransformResult {
  try {
    const settings = levelObj.settings || {}

    // 1. version check
    const currentVersion = settings.version || 1
    if (currentVersion < 8) {
      return { success: false, content: "", message: "versionTooLow" }
    }

    // 2. angleData (root or settings) -> pathData (root)
    const angleData = levelObj.angleData || settings.angleData
    if (angleData !== undefined) {
      const table = pathDataUtils.pathDataTable
      const reverseTable: Record<number, string> = {}
      for (const key in table) {
        reverseTable[table[key]] = key
      }

      let pathDataStr = ""
      const angles = Array.isArray(angleData) ? angleData : []
      
      for (const angle of angles) {
        // Special case: 999 is "!"
        if (angle === 999) {
          pathDataStr += "!"
          continue
        }
        
        const char = reverseTable[angle]
        if (char === undefined) {
          return { success: false, content: "", message: "angleIncompatible" }
        }
        pathDataStr += char
      }
      levelObj.pathData = pathDataStr
      delete levelObj.angleData
      delete settings.angleData
      delete settings.pathData
    }

    // 3. true/false -> Enabled/Disabled
    const booleanKeys = [
      "separateCountdownTime", "seizureWarning", "showDefaultBGIfNoImage",
      "showDefaultBGTile", "imageSmoothing", "lockRot", "loopBG",
      "pulseOnFloor", "startCamLowVFX", "loopVideo", "floorIconOutlines",
      "stickToFloors", "legacyFlash", "legacyCamRelativeTo",
      "legacySpriteTiles", "legacyTween", "disableV15Features"
    ]

    for (const key of booleanKeys) {
      if (settings[key] === true) settings[key] = "Enabled"
      if (settings[key] === false) settings[key] = "Disabled"
    }

    // 4. Remove legacy compatibility options
    delete settings.legacyFlash
    delete settings.legacyCamRelativeTo
    delete settings.legacySpriteTiles
    delete settings.legacyTween
    delete settings.disableV15Features

    // 5. Downgrade version
    settings.version = 8

    // 6. Reorder
    const reordered = reorderLevel(levelObj, "pathData")

    return {
      success: true,
      content: JSON.stringify(reordered, null, "\t")
    }
  } catch (err) {
    return { success: false, content: "", message: String(err) }
  }
}