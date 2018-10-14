// 3rd-party dependencies
require = require('esm')(module)
module.exports = require('./cli.esm.js') // Side-effects only

console.debug(module === process.mainModule)
console.debug('module', module)
console.debug('mainModule', process.mainModule)

console.info(`Process PID: ${process.pid}`) // verbose 2
console.info(`process.cwd: ${process.cwd()}`) // verbose 2
console.info(`process.execPath: ${process.execPath}`) // verbose 2