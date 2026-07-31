import { describe, it, expect } from 'vitest'
import { applyBlockType } from 'common/fountain/blocks'

const lines = (text: string): string[] => text.split('\n')

describe('applyBlockType', () => {
  it('upper-cases a scene heading and separates it from its neighbours', () => {
    const { text, line } = applyBlockType('Some action.\nthe kitchen - day', 1, 'scene_heading')

    expect(lines(text)).toEqual(['Some action.', '', '.THE KITCHEN - DAY'])
    expect(line).toBe(2)
  })

  it('leaves a recognised scene prefix unforced', () => {
    const { text } = applyBlockType('int. kitchen - day', 0, 'scene_heading')

    expect(lines(text)).toEqual(['INT. KITCHEN - DAY'])
  })

  it('seeds an empty line with a scene prefix to type into', () => {
    const { text } = applyBlockType('', 0, 'scene_heading')

    expect(lines(text)).toEqual(['INT. '])
  })

  it('closes the gap under a character cue so dialogue attaches to it', () => {
    const { text } = applyBlockType('steel\n\nThey came from the sea.', 0, 'character')

    expect(lines(text)).toEqual(['STEEL', 'They came from the sea.'])
  })

  it('joins dialogue to the cue above it', () => {
    const { text, line } = applyBlockType('STEEL\n\nThey came.', 2, 'dialogue')

    expect(lines(text)).toEqual(['STEEL', 'They came.'])
    expect(line).toBe(1)
  })

  it('wraps a parenthetical and puts the caret inside the brackets', () => {
    const { text, line, ch } = applyBlockType('STEEL\nnervously', 1, 'parenthetical')

    expect(lines(text)).toEqual(['STEEL', '(nervously)'])
    expect(ch).toBe(lines(text)[line].length - 1)
  })

  it('adds the forcing marker to a transition that does not end in TO:', () => {
    const { text } = applyBlockType('Action.\nsmash cut', 1, 'transition')

    expect(lines(text)).toEqual(['Action.', '', '> SMASH CUT'])
  })

  it('leaves a TO: transition unforced', () => {
    const { text } = applyBlockType('cut to:', 0, 'transition')

    expect(lines(text)).toEqual(['CUT TO:'])
  })

  it('replaces one element marker with another rather than stacking them', () => {
    const { text } = applyBlockType('# ACT ONE', 0, 'synopsis')

    expect(lines(text)).toEqual(['= ACT ONE'])
  })

  it('converts an element back to plain action', () => {
    const { text } = applyBlockType('.THE CURSOR BLINKS', 0, 'action')

    expect(lines(text)).toEqual(['THE CURSOR BLINKS'])
  })

  it('is a no-op for a line index outside the document', () => {
    const { text } = applyBlockType('Action.', 5, 'character')

    expect(text).toBe('Action.')
  })
})
