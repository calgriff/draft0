// Turning a line of a screenplay into a particular element.
//
// Kept pure and line-based so the block menu stays a thin piece of UI: it hands
// over the document, a line index and a target type, and gets back the new
// document plus where the caret should land. Fountain has no markup for most
// elements — what a line *is* depends on its case and the blank lines around
// it — so these transforms mostly rewrite whitespace and case rather than
// insert syntax.

export type FountainBlockType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'page_break'

export interface BlockEdit {
  /** The rewritten document. */
  text: string
  /** Line the caret should end on. */
  line: number
  /** Column the caret should end on; end of the line when omitted. */
  ch?: number
}

const SCENE_PREFIX_REG = /^(?:INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[.\s]/i

export interface LinePosition {
  line: number
  ch: number
}

export interface BlockRange {
  from: LinePosition
  to: LinePosition
}

/**
 * The run of non-blank lines containing `line` — a scene heading, a paragraph
 * of action, or a whole character/parenthetical/dialogue run, since Fountain
 * groups those with the same blank lines that separate everything else.
 *
 * Returns null on a blank line, which belongs to no block.
 */
export const blockRangeAt = (text: string, line: number): BlockRange | null => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (line < 0 || line >= lines.length || !lines[line].trim()) return null

  let start = line
  while (start > 0 && lines[start - 1].trim()) start--

  let end = line
  while (end < lines.length - 1 && lines[end + 1].trim()) end++

  return { from: { line: start, ch: 0 }, to: { line: end, ch: lines[end].length } }
}

/** Strip whatever element markers a line already carries, leaving its text. */
const bareText = (line: string): string =>
  line
    .trim()
    .replace(/^[.#=>!@]+\s*/, '')
    .replace(/\s*<$/, '')
    .replace(/^\((.*)\)$/, '$1')
    .replace(/^\[\[\s*(.*?)\s*\]\]$/, '$1')
    .trim()

const isBlank = (line: string | undefined): boolean => !line || !line.trim()

/** Insert a blank line above `index` unless one is already there (or it is the
 *  top of the document). Returns the index the line has moved to. */
const separateAbove = (lines: string[], index: number): number => {
  if (index > 0 && !isBlank(lines[index - 1])) {
    lines.splice(index, 0, '')
    return index + 1
  }
  return index
}

const separateBelow = (lines: string[], index: number): void => {
  if (index + 1 < lines.length && !isBlank(lines[index + 1])) {
    lines.splice(index + 1, 0, '')
  }
}

/** Remove a blank line above `index`, joining this line to the one before it -
 *  what makes dialogue attach to its character cue. */
const joinAbove = (lines: string[], index: number): number => {
  if (index > 0 && isBlank(lines[index - 1])) {
    lines.splice(index - 1, 1)
    return index - 1
  }
  return index
}

export const applyBlockType = (
  text: string,
  lineIndex: number,
  type: FountainBlockType
): BlockEdit => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { text, line: lineIndex }
  }

  let index = lineIndex
  const content = bareText(lines[index])
  let ch: number | undefined

  switch (type) {
    case 'scene_heading': {
      const upper = content.toUpperCase()
      // A leading dot forces a heading when the text does not open with one of
      // the recognised prefixes.
      lines[index] = upper ? (SCENE_PREFIX_REG.test(upper) ? upper : `.${upper}`) : 'INT. '
      index = separateAbove(lines, index)
      separateBelow(lines, index)
      break
    }
    case 'action':
      lines[index] = content
      index = separateAbove(lines, index)
      separateBelow(lines, index)
      break
    case 'character':
      lines[index] = content.toUpperCase()
      index = separateAbove(lines, index)
      // A cue must be followed directly by its dialogue, so close any gap.
      if (isBlank(lines[index + 1]) && !isBlank(lines[index + 2])) {
        lines.splice(index + 1, 1)
      }
      break
    case 'dialogue':
      lines[index] = content
      index = joinAbove(lines, index)
      break
    case 'parenthetical':
      lines[index] = `(${content})`
      index = joinAbove(lines, index)
      ch = lines[index].length - 1
      break
    case 'transition': {
      const upper = content.toUpperCase()
      lines[index] = /TO:$/.test(upper) ? upper : `> ${upper}`
      index = separateAbove(lines, index)
      separateBelow(lines, index)
      break
    }
    case 'section':
      lines[index] = `# ${content}`
      index = separateAbove(lines, index)
      break
    case 'synopsis':
      lines[index] = `= ${content}`
      index = separateAbove(lines, index)
      break
    case 'note':
      lines[index] = `[[ ${content} ]]`
      ch = lines[index].length - 3
      break
    case 'page_break':
      lines[index] = '==='
      index = separateAbove(lines, index)
      separateBelow(lines, index)
      break
  }

  return { text: lines.join('\n'), line: index, ch }
}
