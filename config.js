// Built-ins

// 3rd-party dependencies
require('dotenv').config() // We only need side-effects on: process.env

let config = {}

// Process text environment variables into more useful types
if (process.env.NODE_VERBOSE){
	let verbosityAsInt = Number(process.env.NODE_VERBOSE)
	if ( typeof verbosityAsInt === 'number' && verbosityAsInt <= 9 && verbosityAsInt >= 0 ){
		config.NODE_VERBOSE = verbosityAsInt
	} else {
		throw Error('config.js: we need a number 0 to 9 (inclusive) for verbosity level (NODE_VERBOSE); you selected: ' + process.env.NODE_VERBOSE)
	}	
}
if (process.env.CSS_SOURCEMAPS){
	if (process.env.CSS_SOURCEMAPS === 'true'){
		config.CSS_SOURCEMAPS = true
	} else if (process.env.CSS_SOURCEMAPS === 'false'){
		config.CSS_SOURCEMAPS = false
	} else {
		throw Error(`config.js: we need exactly 'true' or 'false' for CSS sourcemaps (CSS_SOURCEMAPS); you selected: ' + ${process.env.CSS_SOURCEMAPS}`)
	}	
}

if (config.NODE_VERBOSE >= 2) console.info('process.argv: ', process.argv)

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
exports.config = config