console.info('RUNNING: action_compress-all-logs.js')

// Built-in modules
// (none)

// 3rd-party dependencies
// (none)

// In-house modules
const { Pinguno } = require('./pinguno.js')
const { compressAllLogsToArchive } = require('./logging.js')

let app = new Pinguno()

compressAllLogsToArchive(app.logsDir, app.archiveDir, app.opt.logStandardFilename, false)