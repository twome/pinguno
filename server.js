console.info('RUNNING: server.js')

// Built-in modules

// 3rd-party dependencies
const express = require('express')
const moment = require('moment')

// In-house modules
const { Pingu } = require('./pingu.js')


let app = new Pingu()

app.tellArchiveSize()

app.startPinging(app.pingTargets, app.pingEngineEnum.NodeNetPing)

let connectionStatusTick = setInterval(()=>{
	app.updateInternetConnectionStatus()
	console.log(moment().format('YYYY-MM-DD hh:mm:ss') + ' Internet connected?: ' + app.updateInternetConnectionStatus().humanName)
}, app.connectionStatusIntervalMs)

let updateOutagesTick = setInterval(()=>{	
	app.updateOutages()
}, app.updateOutagesIntervalMs)

// POSSIBLE BUG: this runs almost assuming sync, not sure if need a flag or something to make sure not actively worked on
let alreadyNotifiedLogUri = false
let writeToFileTick = setInterval(()=>{
	if ( app.activeLogUri ){ 
		if (!alreadyNotifiedLogUri){
			console.log('Writing to file. Active log URI found, using that URI.')
			alreadyNotifiedLogUri = true
		}
		app.updateSessionLog()
	} else {
		if (!alreadyNotifiedLogUri){
			console.log('Writing to new log file.')			
			alreadyNotifiedLogUri = true
		}
		app.writeSessionLog() 
	}
}, app.writeToFileIntervalMs)

let exportSessionToTextSummaryTick = setInterval(()=>{
	app.exportSessionToTextSummary()
}, app.exportSessionToTextSummaryIntervalMs)

let updateSessionEndTimeTick = setInterval(()=>{
	app.updateSessionEndTime()
}, app.updateSessionEndTimeIntervalMs)




















// let compressLogToArchiveTick = setInterval(()=>{
// 	app.compressLogToArchive(MyUtil.filenameFromUri(app.activeLogUri))
// }, 20 * 1000)

// let compressAllLogsToArchiveTick = setInterval(()=>{
// 	app.compressAllLogsToArchive()
// }, 5 * 1000)


// TEMP: USING PRE-COOKED DATA
// let updateOutagesTick = setInterval(()=>{
// 	app.readCombinedListFromFile('./logs/test-data_frequent-disconnects.json', (fileData)=>{
// 		app.updateOutages(fileData.combinedPingList, fileData.targetList)
// 	})
// }, 2 * 1000)


