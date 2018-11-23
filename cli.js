#!/usr/bin/env node
// side-effects: true

// 3rd-party dependencies
const { DateTime } = require('luxon')
const _ = {
	debounce: require('lodash/debounce')
}

// In-house modules
import { config } from './config.js'
import { 
	compressAllLogsToArchive, 
	saveSessionLogHuman,
	saveSessionLogJSON,
	readJSONLogIntoSession
} from './logging.js'
import { Pinguno } from './pinguno.js'

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

setInterval(()=>{
	app.updateGlobalConnectionStatus()
	let stdoutTimeFormat = config.NODE_VERBOSE >= 2 ? 'yyyy-LL-dd HH:mm:ss.SSS' : 'yyyy-LL-dd HH:mm:ss'
	console.log(DateTime.local().toFormat(stdoutTimeFormat) + ' Internet connected?: ' + app.updateGlobalConnectionStatus().humanName)
}, app.opt.connectionStatusIntervalMs)

setInterval(()=>{	
	app.updateOutages()
}, app.opt.updateOutagesIntervalMs)

setInterval(()=>{
	saveSessionLogJSON(app)
}, app.opt.writeToFileIntervalMs)

setInterval(()=>{
	saveSessionLogHuman(app)
}, app.opt.exportSessionToTextSummaryIntervalMs)

setInterval(()=>{
	app.updateSessionEndTime()
}, app.opt.updateSessionEndTimeIntervalMs)

setInterval(()=>{
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