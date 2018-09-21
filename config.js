// 3rd-party dependencies
require('dotenv').config() // We only need side-effects: process.env

let config = {}

// Check environment variables
if (process.env.NODE_VERBOSE){
	let verbosityAsInt = new Number(process.env.NODE_VERBOSE)
	if ( typeof verbosityAsInt === 'number' && verbosityAsInt <= 9 && verbosityAsInt >= 0 ){
		config.nodeVerbose = verbosityAsInt
	} else {
		throw Error('config.js: we need a number 0 to 9 (inclusive) for verbosity level; you selected: ' + process.env.NODE_VERBOSE)
	}	
}

exports.config = config