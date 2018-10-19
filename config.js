// 3rd-party
require('dotenv').config() // We only need side-effects on: process.env

let defaultConfig = {
	exitSelfMsg: 'cleanExit',
	unixProcessStandardSignals: {
		SIGINT: 'SIGINT', // Signal Interrupt - ???
		SIGTERM: 'SIGTERM', // Signal Terminate - let the process clean up its work, then terminate
		SIGKILL: 'SIGKILL', // Signal Kill - unconditionally exit the process
		SIGHUP: 'SIGHUP' // Signal Hang Up
	}
}

let envVars = {}
// Process environment variables (which are string-only) into more useful types & validate them
if (process.env.NODE_VERBOSE){
	let verbosityAsInt = Number(process.env.NODE_VERBOSE)
	if ( typeof verbosityAsInt === 'number' && verbosityAsInt <= 9 && verbosityAsInt >= 0 ){
		envVars.NODE_VERBOSE = verbosityAsInt
	} else {
		throw Error('config.js: we need a number 0 to 9 (inclusive) for verbosity level (NODE_VERBOSE); you selected: ' + process.env.NODE_VERBOSE)
	}	
}
if (process.env.CSS_SOURCEMAPS){
	if (process.env.CSS_SOURCEMAPS === 'true'){
		envVars.CSS_SOURCEMAPS = true
	} else if (process.env.CSS_SOURCEMAPS === 'false'){
		envVars.CSS_SOURCEMAPS = false
	} else {
		throw Error(`config.js: we need exactly 'true' or 'false' for CSS sourcemaps (CSS_SOURCEMAPS); you selected: ' + ${process.env.CSS_SOURCEMAPS}`)
	}	
}
if (process.env.NODE_ENV){
	if (process.env.NODE_ENV === 'development'){
		envVars.NODE_ENV = 'development'
	} else if (process.env.NODE_ENV === 'production'){
		envVars.NODE_ENV = 'production'
	} else {
		throw Error('config.js: NODE_ENV must be "production" or "development"')
	}
}

let clArgs = {}
// Hostname and/or port
// ~ if we are running 'server' cli
// if (process.argv[2]){
// 	let input = process.argv[2]
// 	let hostURL = typeof input === 'string' && new URL(input)

// 	if (hostURL){
// 		config.hostname = hostURL.hostname
// 		config.port = hostURL.port
// 	}
// }

// ~ use lib to easily parse CL args

// ~ overwrite each config[prop] in the following priority order (highest first): 
// CL args
// process.env


// Overwrite config properties accord to the normal Unix order of precendence (command-line arguments > enviroment variables > app defaults)
let config = {}
Object.assign(config, defaultConfig)
Object.assign(config, envVars)
Object.assign(config, clArgs)

exports.config = config