console.info('RUNNING: server.js')

// Built-in modules

// 3rd-party dependencies
const express = require('express')
const moment = require('moment')

// In-house modules
const { 
	compressAllLogsToArchive, 
	compressLogToArchive, 
	saveSessionLogHuman,
	saveSessionLogJSON
} = require('./logging.js')

const { Pingu } = require('./pingu.js')
const { Stats } = require('./stats.js')

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


