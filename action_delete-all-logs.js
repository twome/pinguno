console.info('RUNNING: action_delete-all-logs.js')

// Built-in modules
// (none)

// 3rd-party dependencies
// (none)

// In-house modules
const { Pingu } = require('./pingu.js')
const { deleteAllLogs } = require('./logging.js')

let app = new Pingu()

deleteAllLogs(app.opt.logsDir, app.opt.summariesDir)
