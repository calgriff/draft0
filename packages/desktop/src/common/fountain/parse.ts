// Minimal Fountain (https://fountain.io) parser.
//
// Deliberately hand-written rather than pulled from npm: the preview and the
// export need the same token stream, the spec's structural subset is small,
// and a dependency-free module can live in `common/` and be used from the main
// process, the renderer and the tests alike.
//
// Not implemented (they round-trip as plain action text): dual dialogue, inline
// emphasis, lyrics, and page-break directives.

export type FountainTokenType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'centered'
  | 'section'
  | 'synopsis'
  | 'page_break'

export interface FountainToken {
  type: FountainTokenType
  text: string
  /** Section depth (1-6); only set on `section` tokens. */
  depth?: number
  /** Scene number pulled from a `#12#` suffix; only set on scene headings. */
  sceneNumber?: string
}

export interface FountainScript {
  /** Title-page key/value pairs, keys lowercased (`title`, `credit`, `author`…). */
  title: Record<string, string>
  tokens: FountainToken[]
}

const SCENE_HEADING_REG = /^(?:INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[.\s]/i
const SCENE_NUMBER_REG = /\s*#([^#\n]+)#\s*$/
const TRANSITION_REG = /^[^a-z]*TO:$/
const TITLE_PAGE_KEY_REG = /^([A-Za-z][A-Za-z0-9 _-]*):(.*)$/
const CHARACTER_REG = /^[^a-z]*[A-Z][^a-z]*(?:\(.*\))?\s*\^?$/

const isBlank = (line: string): boolean => line.trim().length === 0

/** An all-caps line is only a character cue if dialogue follows it. */
const isCharacter = (line: string, next: string | undefined): boolean => {
  const trimmed = line.trim()
  if (!trimmed || isBlank(next ?? '')) return false
  if (trimmed.startsWith('@')) return true
  if (!/[A-Z]/.test(trimmed)) return false
  return CHARACTER_REG.test(trimmed) && !TRANSITION_REG.test(trimmed)
}

/**
 * Strip boneyard comments and inline notes (`[[ … ]]`), which may both span
 * lines, before any line-oriented parsing happens.
 */
const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '')

// The title page is only entered when its first line uses one of these keys.
// `Key: value` alone is too loose a test: a screenplay that opens on a
// transition (`CUT TO:`) or a line of dialogue would be swallowed whole.
export const TITLE_PAGE_KEYS = new Set([
  'title',
  'credit',
  'author',
  'authors',
  'source',
  'draft date',
  'date',
  'contact',
  'copyright',
  'notes',
  'revision'
])

/**
 * Consume the optional title page: `Key: value` pairs, possibly with indented
 * continuation lines, terminated by the first blank line. Returns the parsed
 * pairs and the index of the first body line.
 */
const parseTitlePage = (lines: string[]): { title: Record<string, string>; next: number } => {
  const title: Record<string, string> = {}
  const firstKey = lines.length ? lines[0].match(TITLE_PAGE_KEY_REG) : null
  if (!firstKey || !TITLE_PAGE_KEYS.has(firstKey[1].trim().toLowerCase())) {
    return { title, next: 0 }
  }

  let index = 0
  let key = ''
  for (; index < lines.length; index++) {
    const line = lines[index]
    if (isBlank(line)) {
      index++
      break
    }
    const match = line.match(TITLE_PAGE_KEY_REG)
    if (match) {
      key = match[1].trim().toLowerCase()
      title[key] = match[2].trim()
    } else if (key) {
      // Indented continuation of the previous key.
      title[key] = `${title[key]}\n${line.trim()}`.trim()
    }
  }
  return { title, next: index }
}

export const parseFountain = (source: string): FountainScript => {
  const lines = stripComments(source ?? '').replace(/\r\n?/g, '\n').split('\n')
  const { title, next } = parseTitlePage(lines)
  const tokens: FountainToken[] = []

  // Consecutive action lines are merged into one paragraph, matching how a
  // screenplay reads; every other token type is line- or block-scoped.
  let action: string[] = []
  const flushAction = () => {
    if (action.length) {
      tokens.push({ type: 'action', text: action.join('\n') })
      action = []
    }
  }

  for (let i = next; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    if (isBlank(line)) {
      flushAction()
      continue
    }

    if (line === '===' || /^={3,}$/.test(line)) {
      flushAction()
      tokens.push({ type: 'page_break', text: '' })
      continue
    }

    const section = line.match(/^(#{1,6})\s*(.*)$/)
    if (section) {
      flushAction()
      tokens.push({ type: 'section', text: section[2], depth: section[1].length })
      continue
    }

    if (line.startsWith('=')) {
      flushAction()
      tokens.push({ type: 'synopsis', text: line.slice(1).trim() })
      continue
    }

    // A leading `.` forces a scene heading (but `..` is an escaped literal).
    const forcedScene = line.startsWith('.') && !line.startsWith('..')
    if (forcedScene || SCENE_HEADING_REG.test(line)) {
      flushAction()
      let text = forcedScene ? line.slice(1).trim() : line
      const numberMatch = text.match(SCENE_NUMBER_REG)
      if (numberMatch) text = text.replace(SCENE_NUMBER_REG, '').trim()
      tokens.push({
        type: 'scene_heading',
        text: text.toUpperCase(),
        ...(numberMatch ? { sceneNumber: numberMatch[1].trim() } : {})
      })
      continue
    }

    if (line.startsWith('>') && line.endsWith('<')) {
      flushAction()
      tokens.push({ type: 'centered', text: line.slice(1, -1).trim() })
      continue
    }

    if (line.startsWith('>') || TRANSITION_REG.test(line)) {
      flushAction()
      tokens.push({ type: 'transition', text: line.replace(/^>/, '').trim().toUpperCase() })
      continue
    }

    if (isCharacter(raw, lines[i + 1])) {
      flushAction()
      tokens.push({ type: 'character', text: line.replace(/^@/, '').replace(/\s*\^$/, '') })
      // Everything up to the next blank line belongs to this cue.
      for (i++; i < lines.length && !isBlank(lines[i]); i++) {
        const speech = lines[i].trim()
        if (speech.startsWith('(') && speech.endsWith(')')) {
          tokens.push({ type: 'parenthetical', text: speech })
        } else {
          tokens.push({ type: 'dialogue', text: speech })
        }
      }
      continue
    }

    action.push(line.startsWith('!') ? line.slice(1) : line)
  }

  flushAction()
  return { title, tokens }
}
