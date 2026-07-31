import { describe, it, expect } from 'vitest'
import { parseFountain } from 'common/fountain/parse'
import { fountainToHtml } from 'common/fountain/toHtml'

describe('parseFountain', () => {
  it('reads the title page and stops at the first blank line', () => {
    const { title, tokens } = parseFountain(
      ['Title: Big Fish', 'Credit: Written by', 'Author: John August', '', 'Some action.'].join('\n')
    )

    expect(title).toEqual({
      title: 'Big Fish',
      credit: 'Written by',
      author: 'John August'
    })
    expect(tokens).toEqual([{ type: 'action', text: 'Some action.' }])
  })

  it('starts in the body when the first line is not a key/value pair', () => {
    const { title, tokens } = parseFountain('They walk in.\n\nSomething: happens later.')

    expect(title).toEqual({})
    expect(tokens[0]).toEqual({ type: 'action', text: 'They walk in.' })
    // Once the body has started, a colon is just punctuation.
    expect(tokens[1]).toEqual({ type: 'action', text: 'Something: happens later.' })
  })

  it('ends the title page at the first line that is not a known key', () => {
    // `FADE IN:` looks exactly like a `Key: value` pair. Treating it as one
    // made it swallow the entire screenplay as that key's continuation.
    const { title, tokens } = parseFountain(
      ['Title: Big Fish', 'Author: John August', 'FADE IN:', '', 'INT. HOUSE - DAY'].join('\n')
    )

    expect(Object.keys(title)).toEqual(['title', 'author'])
    expect(tokens.map((t) => t.type)).toEqual(['action', 'scene_heading'])

    // Even with the blank line missing the body must still be parsed, rather
    // than absorbed into the title page.
    const noBlank = parseFountain(
      ['Title: Big Fish', 'FADE IN:', 'INT. HOUSE - DAY'].join('\n')
    )
    expect(Object.keys(noBlank.title)).toEqual(['title'])
    expect(noBlank.tokens.length).toBeGreaterThan(0)
  })

  it('keeps indented continuation lines with their title-page key', () => {
    const { title } = parseFountain(['Contact:', '  1 Fake Street', '  London', '', 'Action.'].join('\n'))

    expect(title.contact).toBe('1 Fake Street\nLondon')
  })

  it('does not lose the line that ends a dialogue run', () => {
    // A dialogue run normally ends at a blank line; when one is missing it
    // ends at the next structural line instead, which must still be parsed.
    const { tokens } = parseFountain(['STEEL', 'Hello.', 'CUT TO:', 'INT. HOUSE - DAY'].join('\n'))

    expect(tokens.map((t) => t.type)).toEqual([
      'character',
      'dialogue',
      'transition',
      'scene_heading'
    ])
  })

  it('recognises scene headings, forced headings and scene numbers', () => {
    const { tokens } = parseFountain(
      ['EXT. BEACH - DAY #1#', '', 'Waves.', '', '.A FORCED SLUG', '', 'More.'].join('\n')
    )

    expect(tokens[0]).toEqual({
      type: 'scene_heading',
      text: 'EXT. BEACH - DAY',
      sceneNumber: '1'
    })
    expect(tokens[2]).toEqual({ type: 'scene_heading', text: 'A FORCED SLUG' })
  })

  it('parses a dialogue run into character, parenthetical and dialogue', () => {
    const { tokens } = parseFountain(
      ['STEEL', '(nervously)', 'They came from the sea.', '', 'He turns away.'].join('\n')
    )

    expect(tokens.map((t) => t.type)).toEqual([
      'character',
      'parenthetical',
      'dialogue',
      'action'
    ])
    expect(tokens[0].text).toBe('STEEL')
  })

  it('distinguishes a transition from a character cue', () => {
    const { tokens } = parseFountain(['CUT TO:', '', 'INT. HOUSE - NIGHT'].join('\n'))

    expect(tokens[0]).toEqual({ type: 'transition', text: 'CUT TO:' })
  })

  it('merges consecutive action lines into one paragraph', () => {
    const { tokens } = parseFountain(['They run.', 'They keep running.'].join('\n'))

    expect(tokens).toEqual([{ type: 'action', text: 'They run.\nThey keep running.' }])
  })

  it('strips boneyard comments and inline notes', () => {
    const { tokens } = parseFountain('Action /* hidden */ text [[a note]] here.')

    expect(tokens[0].text).toBe('Action  text  here.')
  })
})

describe('fountainToHtml', () => {
  it('escapes source text so nothing user-authored becomes markup', () => {
    const html = fountainToHtml('A <script>alert(1)</script> prop.')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('emits the class names the screenplay stylesheet targets', () => {
    const html = fountainToHtml(['INT. ROOM - DAY', '', 'STEEL', 'Hello.'].join('\n'))

    expect(html).toContain('class="fountain-script"')
    expect(html).toContain('class="scene-heading"')
    expect(html).toContain('class="character"')
    expect(html).toContain('class="dialogue"')
  })
})
