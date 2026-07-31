// CodeMirror "fountain" — syntax highlighting for Fountain screenplays.
//
// Registered by hand rather than lazily loaded: `loadmode.ts` only globs
// `node_modules/codemirror/mode/**`, so a mode that lives in this repo is
// invisible to `autoLoadMode`.
//
// Token names are deliberately CodeMirror's standard ones (`keyword`, `def`,
// `atom`, `string`, `comment`, `variable-2`) rather than fountain-specific
// classes, so every bundled editor theme styles the mode without changes.

import { TITLE_PAGE_KEYS } from 'common/fountain/parse'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeMirrorLike = any

interface FountainState {
  /** Inside the title-page block, which ends at the first blank line. */
  inTitlePage: boolean
  /** Inside a dialogue run started by a character cue. */
  inDialogue: boolean
  /** Inside a boneyard comment. */
  inComment: boolean
}

const SCENE_HEADING_REG = /^(?:INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[.\s]/i
const TRANSITION_REG = /^[^a-z]*TO:$/
const TITLE_PAGE_KEY_REG = /^([A-Za-z][A-Za-z0-9 _-]*):/
const CHARACTER_REG = /^[^a-z]*[A-Z][^a-z]*(?:\(.*\))?\s*\^?$/

const registerFountainMode = (CodeMirror: CodeMirrorLike): void => {
  if (CodeMirror.modes && Object.prototype.hasOwnProperty.call(CodeMirror.modes, 'fountain')) {
    return
  }

  CodeMirror.defineMode('fountain', () => ({
    startState: (): FountainState => ({
      inTitlePage: true,
      inDialogue: false,
      inComment: false
    }),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    token(stream: any, state: FountainState): string | null {
      if (state.inComment) {
        if (stream.match(/^[\s\S]*?\*\//)) state.inComment = false
        else stream.skipToEnd()
        return 'comment'
      }

      if (stream.sol()) {
        const line = stream.string as string
        const trimmed = line.trim()

        if (!trimmed) {
          // A blank line closes both the title page and any dialogue run.
          state.inTitlePage = false
          state.inDialogue = false
          stream.skipToEnd()
          return null
        }

        if (state.inTitlePage) {
          const key = trimmed.match(TITLE_PAGE_KEY_REG)
          if (key && TITLE_PAGE_KEYS.has(key[1].trim().toLowerCase())) {
            stream.skipToEnd()
            return 'meta'
          }
          state.inTitlePage = false
        }

        if (trimmed.startsWith('/*')) {
          if (!stream.match(/^\s*\/\*[\s\S]*?\*\//)) {
            state.inComment = true
            stream.skipToEnd()
          }
          return 'comment'
        }

        if (trimmed.startsWith('[[') || trimmed.startsWith('#')) {
          stream.skipToEnd()
          return trimmed.startsWith('#') ? 'header' : 'comment'
        }

        if (trimmed.startsWith('=')) {
          stream.skipToEnd()
          return /^={3,}$/.test(trimmed) ? 'hr' : 'comment'
        }

        if ((trimmed.startsWith('.') && !trimmed.startsWith('..')) ||
            SCENE_HEADING_REG.test(trimmed)) {
          state.inDialogue = false
          stream.skipToEnd()
          return 'keyword'
        }

        if (trimmed.startsWith('>') || TRANSITION_REG.test(trimmed)) {
          state.inDialogue = false
          stream.skipToEnd()
          return 'atom'
        }

        if (state.inDialogue) {
          stream.skipToEnd()
          return trimmed.startsWith('(') && trimmed.endsWith(')') ? 'variable-2' : 'string'
        }

        // A character cue is an all-caps line with something after it; the
        // tokenizer cannot see the next line, so trailing content on this one
        // (a blank line ends the run) is what distinguishes it in practice.
        if (trimmed.startsWith('@') || CHARACTER_REG.test(trimmed)) {
          state.inDialogue = true
          stream.skipToEnd()
          return 'def'
        }

        stream.skipToEnd()
        return null
      }

      stream.skipToEnd()
      return null
    }
  }))

  CodeMirror.defineMIME('text/x-fountain', 'fountain')
}

export default registerFountainMode
