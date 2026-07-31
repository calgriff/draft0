import { resolveLocalImageSrc } from '../util/resolveImageSrc'

class MarkdownPrint {
  private container: HTMLElement | null = null

  /**
   * Prepare document export and append a hidden print container to the window.
   * Everything outside of this hidden print container will be hidden with display: none.
   *
   * @param html HTML string
   * @param renderStatic Render for static files like PDF documents
   * @param dir Text direction to mirror onto the container. `innerHTML` drops
   *   the exporter's outer `<html dir=…>` shell and the container is a sibling
   *   of `.editor-wrapper`, so RTL documents print LTR unless we set it here
   *   (#4833). LTR is the default and stays implicit.
   */
  renderMarkdown(html: string, renderStatic?: boolean, dir?: string): void {
    this.clearup()
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    if (dir === 'rtl' || dir === 'auto') {
      printContainer.setAttribute('dir', dir)
    }
    this.container = printContainer
    printContainer.innerHTML = html
    this.confinePrintStylesToPrintMedia(printContainer)

    // Fix images when rendering for static files like PDF (GH#678).
    if (renderStatic) {
      // Traverse through the DOM tree and fix all relative image sources.
      const images = printContainer.getElementsByTagName('img')
      for (const image of Array.from(images)) {
        const rawSrc = image.getAttribute('src') ?? ''
        image.src = resolveLocalImageSrc(rawSrc)
      }
    }

    document.body.appendChild(printContainer)
  }

  /**
   * The exported document is a standalone page, so its `<style>` blocks are
   * written for a document where nothing else exists. Appending the container
   * to `document.body` makes those styles global, and they restyle the visible
   * editor for as long as the export runs — a theme-derived stylesheet even
   * repaints `html`. Wrapping each block in `@media print` keeps it inert on
   * screen while still applying to `printToPDF` and `webContents.print`, which
   * both render in the print medium.
   */
  private confinePrintStylesToPrintMedia(container: HTMLElement): void {
    for (const style of Array.from(container.querySelectorAll('style'))) {
      const css = style.textContent
      if (css) {
        style.textContent = `@media print {\n${css}\n}`
      }
    }
  }

  /**
   * Remove the print container from the window.
   */
  clearup(): void {
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }
}

export default MarkdownPrint
