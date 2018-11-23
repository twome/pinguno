#!/usr/bin/env node
console.info('[server-esm-adapter] requiring server.js as an ESM module')
// 3rd-party dependencies
require = require('esm')(module) /* eslint-disable-line no-global-assign */ // Replace require with "esm" module's shim for loading ESM
module.exports = require('../server.js') // We want side-effects only