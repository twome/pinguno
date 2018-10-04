console.info('RUNNING: action_delete-all-logs.js')

// Built-in modules
// (none)

// 3rd-party dependencies
// (none)

// In-house modules
const { Pinguno } = require('./pinguno.js')
const { deleteAllLogs } = require('./logging.js')

let app = new Pinguno()

deleteAllLogs(app.logsDir, app.summariesDir)
