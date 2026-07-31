import { fountainToHtml } from 'common/fountain/toHtml'
import screenplayTheme from '@/assets/themes/export/screenplay.theme.css?inline'

export interface ExportScreenplayOptions {
  title?: string
  /** Extra CSS from the export dialog (page margins, font overrides, …). */
  extraCss?: string
  /** Editor text direction; set on the exported `<html>`. */
  dir?: string
}

/**
 * Build a standalone HTML document for a Fountain screenplay.
 *
 * Deliberately separate from `exportStyledHTML`: that path renders through the
 * muya engine and layers github-markdown-css, neither of which applies here —
 * a screenplay's layout *is* its formatting, and it comes entirely from
 * `screenplay.theme.css`.
 */
export const exportScreenplayHTML = (
  source: string,
  { title = '', extraCss = '', dir }: ExportScreenplayOptions = {}
): string => {
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `<!DOCTYPE html>
<html lang="en"${dir && dir !== 'ltr' ? ` dir="${dir}"` : ''}>
<head>
<meta charset="utf-8">
<title>${escapedTitle}</title>
<style>
${screenplayTheme}
${extraCss}
</style>
</head>
<body>
${fountainToHtml(source)}
</body>
</html>`
}
