// Built-in modules

// 3rd-party dependencies
const { DateTime } = require('luxon')
const _ = {
	debounce: require('lodash/debounce')
}

// In-house modules
const { config } = require('./config.js')
const { 
	compressAllLogsToArchive, 
	saveSessionLogHuman,
	saveSessionLogJSON,
	readJSONLogIntoSession
} = require('./logging.js')
const { Pinguno } = require('./pinguno.js')

if (config.NODE_VERBOSE >= 2){
	console.info('  -----\nStarting Pinguno\n  -----') // verbose 2
	console.info(`Process PID: ${process.pid}`) // verbose 2
	console.info(`process.cwd: ${process.cwd()}`) // verbose 2
	console.info(`process.execPath: ${process.execPath}`) // verbose 2
}

let app = new Pinguno()

if (config.NODE_VERBOSE >= 2){
	app.tellStatus()
}

app.startPinging(
	app.pingTargets
	/*, app.pingEngineEnum.NodeNetPing*/
)

let connectionStatusTick = setInterval(()=>{
	app.updateGlobalConnectionStatus()
	let stdoutTimeFormat = config.NODE_VERBOSE >= 2 ? 'yyyy-LL-dd HH:mm:ss.SSS' : 'yyyy-LL-dd HH:mm:ss'
	console.log(DateTime.local().toFormat(stdoutTimeFormat) + ' Internet connected?: ' + app.updateGlobalConnectionStatus().humanName)
}, app.opt.connectionStatusIntervalMs)

let updateOutagesTick = setInterval(()=>{	
	app.updateOutages()
}, app.opt.updateOutagesIntervalMs)

let writeToFileTick = setInterval(()=>{
	Promise.resolve(saveSessionLogJSON(app)).then((val)=>{
		// TEMP - dev only, testing reading of json logs with real live data
		if (typeof val === 'string'){
			let respondToRead = (newSessionFromRead)=>{
				// console.debug(newSessionFromRead)
			}

			readJSONLogIntoSession(app.activeLogUri)
				.then(respondToRead)
				.catch((err)=>{
					console.debug('readJSONLogIntoSession - error:', err)
				})
		}
	}, (err)=>{
		console.error(err)
	})
}, app.opt.writeToFileIntervalMs)

let exportSessionToTextSummaryTick = setInterval(()=>{
	saveSessionLogHuman(app)
}, app.opt.exportSessionToTextSummaryIntervalMs)

let updateSessionEndTimeTick = setInterval(()=>{
	app.updateSessionEndTime()
}, app.opt.updateSessionEndTimeIntervalMs)

let statsTick = setInterval(()=>{
	app.updateSessionStats()
	console.info(app.sessionStats)
}, app.opt.updateSessionStatsIntervalMs)

// Compress all loose JSON logs to a single gzipped archive if the folder has grown excessively large
app.getArchiveSizeMiB((sizeMiB)=>{
	console.warn(`Logs directory size: ${sizeMiB}MiB`)
	if (sizeMiB >= app.opt.maxUncompressedSizeMiB){
		console.warn(`Logs directory size exceeds ${app.opt.maxUncompressedSizeMiB}MiB, compressing all logs...`)
		compressAllLogsToArchive(app.logsDir, app.archiveDir, app.opt.logStandardFilename, app.opt.compressAnyJsonLogs)
	}	
})

let handlePOSIXSignal = (signalStr)=>{
	let ensureExit = ()=>{
		setTimeout(()=>{
			process.exit() // Don't wait longer than a second before exiting, despite app's memory/storage/request state.
		}, 1000)
	}

	if (signalStr === 'SIGINT'){
		console.info('[server] Received SIGINT; program is now exiting. If it takes too long, press Control-\\ to force exit.')
		app.cleanExit()
		ensureExit()
	}

	// Regardless of specific signal, ensure we exit
	ensureExit()
}
process.on('SIGINT', handlePOSIXSignal)

process.on('exit', (code)=>{
	// Everything returned asynchronously will be ignored before the program exits
	console.info(`cli.js - About to exit with code: ${code}`)
})