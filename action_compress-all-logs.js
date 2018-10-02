console.info('RUNNING: action_compress-all-logs.js')

// Built-in modules
// (none)

// 3rd-party dependencies
// (none)

// In-house modules
const { Pingu } = require('./pingu.js')
const { compressAllLogsToArchive } = require('./logging.js')

let app = new Pingu()

compressAllLogsToArchive(app.opt.logsDir, app.opt.archiveDir, app.opt.logStandardFilename, false)