// Built-in modules

// 3rd-party dependencies
const express = require('express')
const moment = require('moment')

// In-house modules
const { config } = require('./config.js')
const { 
	compressAllLogsToArchive, 
	compressLogToArchive, 
	saveSessionLogHuman,
	saveSessionLogJSON
} = require('./logging.js')
const { Pingu } = require('./pingu.js')
const { Stats } = require('./stats.js')

if (config.nodeVerbose >= 2){
	console.info('RUNNING: start.js') // verbose 2
	console.info(`Process PID: ${process.pid}`) // verbose 2
	console.info(`process.cwd: ${process.cwd()}`) // verbose 2
	console.info(`process.execPath: ${process.execPath}`) // verbose 2
}

let app = new Pingu()

app.tellArchiveSize()

app.startPinging(app.pingTargets/*, app.pingEngineEnum.NodeNetPing*/)

let connectionStatusTick = setInterval(()=>{
	app.updateInternetConnectionStatus()
	console.log(moment().format('YYYY-MM-DD hh:mm:ss') + ' Internet connected?: ' + app.updateInternetConnectionStatus().humanName)
}, app.opt.connectionStatusIntervalMs)

let updateOutagesTick = setInterval(()=>{	
	app.updateOutages()
}, app.opt.updateOutagesIntervalMs)

let writeToFileTick = setInterval(()=>{
	saveSessionLogJSON(app)
}, app.opt.writeToFileIntervalMs)

let exportSessionToTextSummaryTick = setInterval(()=>{
	saveSessionLogHuman(app)
}, app.opt.exportSessionToTextSummaryIntervalMs)

let updateSessionEndTimeTick = setInterval(()=>{
	app.updateSessionEndTime()
}, app.opt.updateSessionEndTimeIntervalMs)

let statsTick = setInterval(()=>{
	app.updateSessionStats()
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
		console.info('\nReceived SIGINT; exiting program. Press Control-\\ to force exit.')
		process.exit()
	}
	process.exit()	
}

process.on('SIGINT', handlePOSIXSignal)

process.on('exit', (code)=>{
	// Everything returned asynchronously will be ignored before the program exits
	console.info(`start.js - About to exit with code: ${code}`)
})