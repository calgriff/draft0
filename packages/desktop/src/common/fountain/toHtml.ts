import { parseFountain, type FountainScript, type FountainToken } from './parse'

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Fountain's inline emphasis: `***bold italic***`, `**bold**`, `*italic*`, `_underline_`. */
const renderInline = (text: string): string =>
  escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<u>$1</u>')

const renderToken = (token: FountainToken): string => {
  const inline = renderInline(token.text)
  switch (token.type) {
    case 'scene_heading':
      return `<h2 class="scene-heading">${inline}${
        token.sceneNumber ? `<span class="scene-number">${escapeHtml(token.sceneNumber)}</span>` : ''
      }</h2>`
    case 'character':
      return `<p class="character">${inline}</p>`
    case 'parenthetical':
      return `<p class="parenthetical">${inline}</p>`
    case 'dialogue':
      return `<p class="dialogue">${inline}</p>`
    case 'transition':
      return `<p class="transition">${inline}</p>`
    case 'centered':
      return `<p class="centered">${inline}</p>`
    case 'section':
      return `<p class="section section-${token.depth ?? 1}">${inline}</p>`
    case 'synopsis':
      return `<p class="synopsis">${inline}</p>`
    case 'page_break':
      return '<div class="page-break"></div>'
    case 'action':
    default:
      return `<p class="action">${inline.replace(/\n/g, '<br>')}</p>`
  }
}

const renderTitlePage = (title: Record<string, string>): string => {
  if (!Object.keys(title).length) return ''
  const line = (key: string, className: string): string =>
    title[key] ? `<p class="${className}">${renderInline(title[key])}</p>` : ''

  // A title page has four zones, and which one a key belongs to is a
  // convention of the format rather than anything in the syntax:
  //   notes                       top-left, italic (rights, disclaimers)
  //   title/credit/author/source  centred, upper-middle
  //   date/draft/revision/©       centred, below the title block
  //   contact + anything else     bottom-left
  const MAIN_KEYS = ['title', 'credit', 'author', 'authors', 'source']
  const DETAIL_KEYS = ['date', 'draft date', 'revision', 'copyright']

  const zone = (className: string, keys: string[]): string => {
    const present = keys.filter((key) => title[key])
    if (!present.length) return ''
    return `<div class="${className}">
${present.map((key) => `<p>${renderInline(title[key])}</p>`).join('\n')}
</div>`
  }

  const placed = new Set([...MAIN_KEYS, ...DETAIL_KEYS, 'notes'])
  const contactKeys = Object.keys(title).filter((key) => !placed.has(key))

  return `<section class="title-page">
${zone('title-page-notes', ['notes'])}
<div class="title-page-main">
${line('title', 'title-page-title')}
${line('credit', 'title-page-credit')}
${line('author', 'title-page-author')}
${line('authors', 'title-page-author')}
${line('source', 'title-page-source')}
</div>
${zone('title-page-details', DETAIL_KEYS)}
${zone('title-page-contact', contactKeys)}
</section>`
}

/**
 * Render a parsed screenplay as semantic HTML. Layout lives entirely in
 * `screenplay.theme.css`, so the same markup serves the in-app preview and the
 * exported document.
 */
export const scriptToHtml = (script: FountainScript): string => {
  const body = script.tokens.map(renderToken).join('\n')
  return `<article class="fountain-script">
${renderTitlePage(script.title)}
${body}
</article>`
}

export const fountainToHtml = (source: string): string => scriptToHtml(parseFountain(source))
