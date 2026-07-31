// Export CSS derived from whatever theme the editor is wearing right now.
//
// The app themes cannot simply be reused for export: `patchTheme()` in
// `util/theme.ts` wraps every theme in `@media not print`, and the exported
// document is a standalone file built by @muyajs/core on top of
// github-markdown-css, which knows nothing about marktext's tokens. So instead
// of shipping theme CSS we resolve the live token values and re-emit them as
// concrete `.markdown-body` rules that layer over github-markdown-css.
//
// Values are read through a probe element rather than
// `getComputedStyle(documentElement).getPropertyValue('--x')`, because most
// tokens are declared as `var(--other)` chains (e.g. `--h1Color: var(
// --headingColor)`) and only the probe resolves them to a real colour. This
// also means user-supplied themes and custom CSS are picked up for free.

/** Tokens that end up in the exported stylesheet, with a safe fallback. */
const TOKENS = {
  themeColor: '#21b56f',
  editorColor: '#24292f',
  editorColor50: '#6e7781',
  editorBgColor: '#ffffff',
  codeBlockBgColor: 'rgba(0, 0, 0, 0.03)',
  codeBgColor: 'rgba(0, 0, 0, 0.05)',
  tableBorderColor: '#e5e5e5',
  headingColor: '#24292f',
  h1Color: '#24292f',
  h2Color: '#24292f',
  h3Color: '#24292f',
  h4Color: '#24292f',
  h5Color: '#24292f',
  h6Color: '#24292f',
  blockquoteTextColor: '#6e7781',
  blockquoteBorderColor: '#21b56f',
  hrColor: '#e6e6e6',
  linkColor: '#21b56f',
  strongColor: '#24292f',
  emColor: '#24292f',
  listMarkerColor: '#6e7781'
} as const

type TokenName = keyof typeof TOKENS
type ResolvedTokens = Record<TokenName, string>

/**
 * Resolve every token to a concrete `rgb()`/`rgba()` string by letting the
 * browser evaluate the `var()` chain on a throwaway element.
 */
const resolveTokens = (): ResolvedTokens => {
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)

  const resolved = {} as ResolvedTokens
  try {
    for (const name of Object.keys(TOKENS) as TokenName[]) {
      probe.style.color = ''
      probe.style.color = `var(--${name})`
      const value = window.getComputedStyle(probe).color
      resolved[name] = value || TOKENS[name]
    }
  } finally {
    probe.remove()
  }
  return resolved
}

interface Rgb {
  r: number
  g: number
  b: number
}

const parseColor = (value: string): Rgb | null => {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (!match) return null
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
const luminance = ({ r, g, b }: Rgb): number => {
  const channel = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrastRatio = (a: Rgb, b: Rgb): number => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const toCss = ({ r, g, b }: Rgb): string =>
  `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

/**
 * Darken `color` towards black until it reads acceptably against `bg`, keeping
 * its hue. Dark themes pick bright accents that wash out on the white page the
 * light-safe path forces, and an unreadable heading is worse than a slightly
 * off one.
 */
const ensureContrast = (color: string, bg: Rgb, minRatio: number): string => {
  const rgb = parseColor(color)
  if (!rgb) return color
  let candidate = rgb
  for (let step = 0; step < 20 && contrastRatio(candidate, bg) < minRatio; step++) {
    candidate = { r: candidate.r * 0.85, g: candidate.g * 0.85, b: candidate.b * 0.85 }
  }
  return toCss(candidate)
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }

export interface CurrentThemeCssOptions {
  /**
   * Reproduce the theme's own background instead of forcing a light page.
   * Off by default: a dark-background PDF wastes ink and reads badly on paper.
   */
  keepDarkBackground?: boolean
}

export const getCurrentThemeExportCss = (options: CurrentThemeCssOptions = {}): string => {
  const tokens = resolveTokens()
  const bg = parseColor(tokens.editorBgColor) ?? WHITE
  // `addThemeStyle()` puts this class on the body for every dark theme, so it
  // covers the built-ins; the luminance check catches custom themes too.
  const isDark = document.body.classList.contains('dark') || luminance(bg) < 0.45
  const lightSafe = isDark && !options.keepDarkBackground

  const pageBg = lightSafe ? '#ffffff' : tokens.editorBgColor
  const pageBgRgb = lightSafe ? WHITE : bg
  const bodyColor = lightSafe ? '#24292f' : tokens.editorColor
  // github-markdown-css leaves code blocks near-white; a dark theme's own code
  // background would swallow the light Prism tokens the export inlines.
  const codeBlockBg = lightSafe ? '#f6f8fa' : tokens.codeBlockBgColor
  const inlineCodeBg = lightSafe ? 'rgba(175, 184, 193, 0.2)' : tokens.codeBgColor

  const accent = (value: string, minRatio = 3.5): string =>
    lightSafe ? ensureContrast(value, pageBgRgb, minRatio) : value

  return `
/* Colours the whole sheet, margins included. The root element's background is
   what propagates to the page canvas; --exportPageBg additionally releases the
   white the print stylesheet would otherwise force. */
:root { --exportPageBg: ${pageBg}; }
html, body { background: ${pageBg}; }
.fountain-script {
  background: ${pageBg};
  color: ${bodyColor};
}
.fountain-script .scene-heading { color: ${accent(tokens.headingColor, 4.5)}; }
.fountain-script .section,
.fountain-script .synopsis { color: ${accent(tokens.blockquoteTextColor, 4.5)}; }
.markdown-body {
  background: ${pageBg};
  color: ${bodyColor};
}
.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: ${accent(tokens.headingColor, 4.5)};
  border-bottom: none;
}
.markdown-body h1 { color: ${accent(tokens.h1Color, 4.5)}; }
.markdown-body h2 { color: ${accent(tokens.h2Color, 4.5)}; }
.markdown-body h3 { color: ${accent(tokens.h3Color, 4.5)}; }
.markdown-body h4 { color: ${accent(tokens.h4Color, 4.5)}; }
.markdown-body h5 { color: ${accent(tokens.h5Color, 4.5)}; }
.markdown-body h6 { color: ${accent(tokens.h6Color, 4.5)}; }
.markdown-body a { color: ${accent(tokens.linkColor)}; }
.markdown-body strong { color: ${accent(tokens.strongColor, 4.5)}; }
.markdown-body em { color: ${accent(tokens.emColor, 4.5)}; }
.markdown-body blockquote {
  color: ${accent(tokens.blockquoteTextColor, 4.5)};
  border-left-color: ${accent(tokens.blockquoteBorderColor, 2)};
}
.markdown-body hr { background-color: ${tokens.hrColor}; border: none; }
.markdown-body ul > li::marker, .markdown-body ol > li::marker {
  color: ${accent(tokens.listMarkerColor, 3)};
}
.markdown-body pre, .markdown-body pre[class*='language-'] {
  background: ${codeBlockBg};
  color: ${bodyColor};
}
.markdown-body :not(pre) > code {
  background: ${inlineCodeBg};
  color: ${bodyColor};
}
.markdown-body table tr { background: ${pageBg}; }
.markdown-body table tr:nth-child(2n) { background: ${inlineCodeBg}; }
.markdown-body table th, .markdown-body table td {
  border-color: ${tokens.tableBorderColor};
}
.markdown-body .toc-container .toc-list a { color: ${accent(tokens.linkColor)}; }
`
}
