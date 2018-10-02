// Built-in modules

// 3rd-party dependencies
const { DateTime } = require('luxon')

// In-house modules
const { config } = require('./config.js')
const { 
	compressAllLogsToArchive, 
	compressLogToArchive, 
	saveSessionLogHuman,
	saveSessionLogJSON,
	readJSONLogIntoSession
} = require('./logging.js')
const { Pingu } = require('./pingu.js')
const { Stats } = require('./stats.js')

if (config.nodeVerbose >= 2){
	console.info('  -----\nStarting Pingu\n  -----') // verbose 2
	console.info(`Process PID: ${process.pid}`) // verbose 2
	console.info(`process.cwd: ${process.cwd()}`) // verbose 2
	console.info(`process.execPath: ${process.execPath}`) // verbose 2
}

let app = new Pingu()

if (config.nodeVerbose >= 2){
	app.tellStatus()
}

app.startPinging(
	app.pingTargets
	/*, app.pingEngineEnum.NodeNetPing*/
)

let connectionStatusTick = setInterval(()=>{
	app.updateInternetConnectionStatus()
	console.log(DateTime.local().toFormat('yyyy-LL-dd HH:mm:ss.SSS') + ' Internet connected?: ' + app.updateInternetConnectionStatus().humanName)
}, app.opt.connectionStatusIntervalMs)

let updateOutagesTick = setInterval(()=>{	
	app.updateOutages()
}, app.opt.updateOutagesIntervalMs)

let writeToFileTick = setInterval(()=>{
	Promise.resolve(saveSessionLogJSON(app)).then((val)=>{
		// TEMP
		// Testing reading from file into a new Pingu session
		/*console.debug('WriteToFile outcome:', val)
		if (typeof val === 'string'){
			readJSONLogIntoSession(app.activeLogUri).then((newSessionFromRead)=>{
				console.debug('readJSONLogIntoSession - newSessionFromRead:', !!newSessionFromRead)
			},(err)=>{
				console.debug('readJSONLogIntoSession - error:', err)
			})
		}*/
	}, (err)=>{
		console.error(err)
	})
}, app.opt.writeToFileIntervalMs)

// let mockSession = readJSONLogIntoSession('./dev-materials/test-data_frequent-disconnects.json')

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

// Periodically compress all loose JSON logs to a single gzipped archive
// let compressLogToArchiveTick = setInterval(()=>{
// 	compressLogToArchive(MyUtil.filenameFromUri(app.activeLogUri), app.opt.archiveDir, app.opt.logsDir)
// }, 20 * 1000)

// let compressAllLogsToArchiveTick = setInterval(()=>{
// 	compressAllLogsToArchive(app.opt.logsDir, app.opt.archiveDir, app.opt.logStandardFilename, app.opt.compressAnyJsonLogs)
// }, 5 * 1000)


// TEMP: USING PRE-COOKED DATA
// let updateOutagesTick = setInterval(()=>{
// 	app.readCombinedListFromFile('./logs/test-data_frequent-disconnects.json', (fileData)=>{
// 		app.updateOutages(fileData.combinedPingList, fileData.targetList)
// 	})
// }, 2 * 1000)

let handlePOSIXSignal = (signalStr)=>{
	if (signalStr === 'SIGINT'){
		console.info('\nReceived SIGINT; program is now exiting. If it takes too long, press Control-\\ to force exit.')
		process.exit()
	}

	// Regardless of specific signal, ensure we exit
	process.exit()	
}

process.on('SIGINT', handlePOSIXSignal)

process.on('exit', (code)=>{
	// Everything returned asynchronously will be ignored before the program exits
	console.info(`start.js - About to exit with code: ${code}`)
})