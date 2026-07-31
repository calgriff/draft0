import path from 'path'
import { app } from 'electron'

// Set `__static` path to static files in production / development depending on the environment
;(global as unknown as { __static: string }).__static = path
  .join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'static')
  .replace(/\\/g, '\\\\')

/**
 * Directory holding the bundled static assets (icons, locales, the preference
 * schema), in both development and packaged builds.
 *
 * Prefer this over reading `global.__static` directly, and never derive the
 * path from `process.cwd()` — that only happens to work when the process was
 * launched from the package directory.
 */
export const getStaticPath = (): string => (global as unknown as { __static: string }).__static
