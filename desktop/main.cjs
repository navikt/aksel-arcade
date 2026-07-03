const path = require('node:path')

const compiledEntry = path.resolve(__dirname, 'dist/main.cjs')

try {
  require(compiledEntry)
} catch (error) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'MODULE_NOT_FOUND' &&
    typeof error.message === 'string' &&
    error.message.includes(compiledEntry)
  ) {
    throw new Error(
      'Desktop Arcade main-process bundle is missing. Run "npm run desktop:build" or "npm run desktop:dev" before launching Electron.'
    )
  }

  throw error
}
