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

  // The remaining keys (contact, draft date, notes…) sit bottom-left, which is
  // where a title page conventionally puts them. They live in their own
  // container: positioning them as a group is what pushes them down the page,
  // and a `:first-of-type` rule cannot do it because every child here is a
  // `<p>` — it would match the title instead.
  const known = new Set(['title', 'credit', 'author', 'authors', 'source'])
  const restKeys = Object.keys(title).filter((key) => !known.has(key))
  const rest = restKeys.length
    ? `<div class="title-page-meta">
${restKeys.map((key) => `<p>${renderInline(title[key])}</p>`).join('\n')}
</div>`
    : ''

  return `<section class="title-page">
<div class="title-page-main">
${line('title', 'title-page-title')}
${line('credit', 'title-page-credit')}
${line('author', 'title-page-author')}
${line('authors', 'title-page-author')}
${line('source', 'title-page-source')}
</div>
${rest}
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
