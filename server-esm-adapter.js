console.info('[server-esm-adapter] Running.')
// 3rd-party dependencies
require = require('esm')(module) /* eslint-disable-line no-global-assign */
module.exports = require('./server.js') // Side-effects only