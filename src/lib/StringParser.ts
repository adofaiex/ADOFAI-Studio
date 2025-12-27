class StringParser {
  parse(text: string | null, reviver?: (key: string, value: any) => any): any {
    if (text == null) return null
    const result = new ParserX(text).parseValue()
    if (typeof reviver === "function") {
      return StringParser._applyReviver("", result, reviver)
    }
    return result
  }

  stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string {
    const serializer = new Serializer(replacer, space)
    return serializer.serialize(value)
  }

  static _applyReviver(key: string, value: any, reviver: (key: string, value: any) => any): any {
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = StringParser._applyReviver(i.toString(), value[i], reviver)
        }
      } else {
        for (const prop in value) {
          if (Object.prototype.hasOwnProperty.call(value, prop)) {
            value[prop] = StringParser._applyReviver(prop, value[prop], reviver)
          }
        }
      }
    }
    return reviver(key, value)
  }
}

class ParserX {
  static WHITE_SPACE = " \t\n\r\uFEFF"
  static WORD_BREAK = ' \t\n\r{}[],:"'
  static TOKEN = {
    NONE: 0,
    CURLY_OPEN: 1,
    CURLY_CLOSE: 2,
    SQUARED_OPEN: 3,
    SQUARED_CLOSE: 4,
    COLON: 5,
    COMMA: 6,
    STRING: 7,
    NUMBER: 8,
    TRUE: 9,
    FALSE: 10,
    NULL: 11,
  }
  private json: string
  private position: number
  private endSection: string | null
  constructor(jsonString: string, endSection: string | null = null) {
    this.json = jsonString
    this.position = 0
    this.endSection = endSection
    if (this.peek() === 0xfeff) {
      this.read()
    }
  }
  parseValue(): any {
    return this.parseByToken(this.nextToken)
  }
  parseObject(): Record<string, any> | null {
    const obj: Record<string, any> = {}
    this.read()
    while (true) {
      let nextToken
      do {
        nextToken = this.nextToken
        if (nextToken === ParserX.TOKEN.NONE) {
          return null
        }
        if (nextToken === ParserX.TOKEN.CURLY_CLOSE) {
          return obj
        }
      } while (nextToken === ParserX.TOKEN.COMMA)
      const key = this.parseString()
      if (key === null) {
        return null
      }
      if (this.nextToken !== ParserX.TOKEN.COLON) {
        return null
      }
      if (this.endSection == null || key !== this.endSection) {
        this.read()
        obj[key] = this.parseValue()
      } else {
        return obj
      }
    }
  }
  parseArray(): any[] | null {
    const array: any[] = []
    this.read()
    let parsing = true
    while (parsing) {
      const nextToken = this.nextToken
      switch (nextToken) {
        case ParserX.TOKEN.NONE:
          return null
        case ParserX.TOKEN.SQUARED_CLOSE:
          parsing = false
          break
        case ParserX.TOKEN.COMMA:
          break
        default:
          const value = this.parseByToken(nextToken)
          array.push(value)
          break
      }
    }
    return array
  }
  parseByToken(token: number): any {
    switch (token) {
      case ParserX.TOKEN.CURLY_OPEN:
        return this.parseObject()
      case ParserX.TOKEN.SQUARED_OPEN:
        return this.parseArray()
      case ParserX.TOKEN.STRING:
        return this.parseString()
      case ParserX.TOKEN.NUMBER:
        return this.parseNumber()
      case ParserX.TOKEN.TRUE:
        return true
      case ParserX.TOKEN.FALSE:
        return false
      case ParserX.TOKEN.NULL:
        return null
      default:
        return null
    }
  }
  parseString(): string | null {
    let result = ""
    this.read()
    let parsing = true
    while (parsing) {
      if (this.peek() === -1) {
        break
      }
      const char = this.nextChar
      switch (char) {
        case '"':
          parsing = false
          break
        case "\\":
          if (this.peek() === -1) {
            parsing = false
            break
          }
          const escaped = this.nextChar
          switch (escaped) {
            case '"':
            case "/":
            case "\\":
              result += escaped
              break
            case "b":
              result += "\b"
              break
            case "f":
              result += "\f"
              break
            case "n":
              result += "\n"
              break
            case "r":
              result += "\r"
              break
            case "t":
              result += "\t"
              break
            case "u":
              let unicode = ""
              for (let i = 0; i < 4; i++) {
                unicode += this.nextChar
              }
              result += String.fromCharCode(Number.parseInt(unicode, 16))
              break
          }
          break
        default:
          result += char
          break
      }
    }
    return result
  }
  parseNumber(): number {
    const word = this.nextWord
    if (word.indexOf(".") === -1) {
      return Number.parseInt(word, 10) || 0
    } else {
      return Number.parseFloat(word) || 0.0
    }
  }
  eatWhitespace(): void {
    while (ParserX.WHITE_SPACE.indexOf(this.peekChar) !== -1) {
      this.read()
      if (this.peek() === -1) {
        break
      }
    }
  }
  peek(): number {
    if (this.position >= this.json.length) {
      return -1
    }
    return this.json.charCodeAt(this.position)
  }
  read(): number {
    if (this.position >= this.json.length) {
      return -1
    }
    return this.json.charCodeAt(this.position++)
  }
  get peekChar(): string {
    const code = this.peek()
    return code === -1 ? "\0" : String.fromCharCode(code)
  }
  get nextChar(): string {
    const code = this.read()
    return code === -1 ? "\0" : String.fromCharCode(code)
  }
  get nextWord(): string {
    let result = ""
    while (ParserX.WORD_BREAK.indexOf(this.peekChar) === -1) {
      result += this.nextChar
      if (this.peek() === -1) {
        break
      }
    }
    return result
  }
  get nextToken(): number {
    this.eatWhitespace()
    if (this.peek() === -1) {
      return ParserX.TOKEN.NONE
    }
    const char = this.peekChar
    switch (char) {
      case '"':
        return ParserX.TOKEN.STRING
      case ",":
        this.read()
        return ParserX.TOKEN.COMMA
      case "-":
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        return ParserX.TOKEN.NUMBER
      case ":":
        return ParserX.TOKEN.COLON
      case "[":
        return ParserX.TOKEN.SQUARED_OPEN
      case "]":
        this.read()
        return ParserX.TOKEN.SQUARED_CLOSE
      case "{":
        return ParserX.TOKEN.CURLY_OPEN
      case "}":
        this.read()
        return ParserX.TOKEN.CURLY_CLOSE
      default:
        const word = this.nextWord
        switch (word) {
          case "false":
            return ParserX.TOKEN.FALSE
          case "true":
            return ParserX.TOKEN.TRUE
          case "null":
            return ParserX.TOKEN.NULL
          default:
            return ParserX.TOKEN.NONE
        }
    }
  }
}

class Serializer {
  private result = ""
  private replacer: ((key: string, value: any) => any) | null
  private space: string | number | null
  private indent = 0
  private indentStr = ""
  constructor(replacer?: (key: string, value: any) => any, space?: string | number) {
    this.replacer = replacer || null
    this.space = space || null
    if (typeof space === "number") {
      this.indentStr = " ".repeat(Math.min(10, Math.max(0, space)))
    } else if (typeof space === "string") {
      this.indentStr = space.slice(0, 10)
    }
  }
  serialize(obj: any): string {
    this.result = ""
    this.serializeValue(obj, "")
    return this.result
  }
  private serializeValue(value: any, key = ""): void {
    if (typeof this.replacer === "function") {
      value = this.replacer(key, value)
    }
    if (value === null || value === undefined) {
      this.result += "null"
    } else if (typeof value === "string") {
      this.serializeString(value)
    } else if (typeof value === "boolean") {
      this.result += value.toString()
    } else if (Array.isArray(value)) {
      this.serializeArray(value)
    } else if (typeof value === "object") {
      this.serializeObject(value)
    } else {
      this.serializeOther(value)
    }
  }
  private serializeObject(obj: Record<string, any>): void {
    let first = true
    this.result += "{"
    if (this.indentStr) {
      this.result += "\n"
      this.indent++
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (Array.isArray(this.replacer) && !this.replacer.includes(key)) {
          continue
        }
        if (!first) {
          this.result += ","
          if (this.indentStr) this.result += "\n"
        }
        if (this.indentStr) {
          this.result += this.indentStr.repeat(this.indent)
        }
        this.serializeString(key.toString())
        this.result += ":"
        if (this.indentStr) this.result += " "
        this.serializeValue(obj[key], key)
        first = false
      }
    }
    if (this.indentStr) {
      this.result += "\n"
      this.indent--
      this.result += this.indentStr.repeat(this.indent)
    }
    this.result += "}"
  }
  private serializeArray(array: any[]): void {
    this.result += "["
    if (this.indentStr && array.length > 0) {
      this.result += "\n"
      this.indent++
    }
    let first = true
    for (let i = 0; i < array.length; i++) {
      if (!first) {
        this.result += ","
        if (this.indentStr) this.result += "\n"
      }
      if (this.indentStr) {
        this.result += this.indentStr.repeat(this.indent)
      }
      this.serializeValue(array[i], i.toString())
      first = false
    }
    if (this.indentStr && array.length > 0) {
      this.result += "\n"
      this.indent--
      this.result += this.indentStr.repeat(this.indent)
    }
    this.result += "]"
  }
  private serializeString(str: string): void {
    this.result += '"'
    for (const char of str) {
      switch (char) {
        case "\b":
          this.result += "\\b"
          break
        case "\t":
          this.result += "\\t"
          break
        case "\n":
          this.result += "\\n"
          break
        case "\f":
          this.result += "\\f"
          break
        case "\r":
          this.result += "\\r"
          break
        case '"':
          this.result += '\\"'
          break
        case "\\":
          this.result += "\\\\"
          break
        default:
          const code = char.charCodeAt(0)
          if (code >= 32 && code <= 126) {
            this.result += char
          } else {
            this.result += "\\u" + code.toString(16).padStart(4, "0")
          }
          break
      }
    }
    this.result += '"'
  }
  private serializeOther(value: any): void {
    if (typeof value === "number") {
      if (isFinite(value)) {
        this.result += value.toString()
      } else {
        this.result += "null"
      }
    } else {
      this.serializeString(value.toString())
    }
  }
}

export default StringParser
export { ParserX, Serializer }
