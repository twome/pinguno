console.log('running pinging.js')

// Inbuilt modules
const { spawn } = require('child_process')
const fs = require('fs')
const util = require('util')
const zlib = require('zlib')

// 3rd party dependencies
const { _ } = require('lodash')
const getFolderSize = require('get-folder-size')
const prettyJson = require('prettyjson')
const moment = require('moment')

// In-house modules
const { Enum } = require('./enum.js')
const { MyUtil } = require('./my-util.js')
const { PingData, PingError, Outage } = require('./ping-formats.js')


const fsWriteFilePromise = util.promisify(fs.writeFile)
const fsReadFilePromise = util.promisify(fs.readFile)

const connectionState = new Enum(['CONNECTED', 'DISCONNECTED', 'PENDING_RESPONSE'])

class Pingu {
	constructor(options){
		this.appHumanName = 'Pingu' // must be filesystem-compatible
		this.appHumanSubtitle = 'ISP Uptime Logger'
		this.appHomepageUrl = 'https://twome.name/pingu'

		this.pingIntervalMs = 5000
		this.badLatencyThresholdMs = 250
		this.connectionStatusIntervalMs = 5000
		this.writeToFileIntervalMs = 2 * 1000

		this.pingTargets = [
			{
				userFacingName: 'Google',
				IPV4: '8.8.8.8',
				connected: null,
				pingList: [],
				pingErrorList: []
			},
			{
				userFacingName: 'Level3',
				IPV4: '4.2.2.2',
				connected: null,
				pingList: [],
				pingErrorList: []
			}
		]
		this.logsDir = './logs'
		this.archiveDir = this.logsDir + '/compressed'
		this.activeLogUri = null // URI string

		this.sessionStartTime = new Date()

		this.lastDateConnected = null
		this.internetConnected = null
		this.outages = []
	}

	updateInternetConnectionStatus(){
		this.updateTargetsConnectionStatus()

		// If at least one target responds, we assume we have a working general internet connection
		for (let target of this.pingTargets){
			if (target.connected === connectionState.CONNECTED){
				return this.internetConnected = connectionState.CONNECTED
			}
		}

		return this.internetConnected = connectionState.DISCONNECTED
	}

	// updateOutages(){
	// 	this.outages.push(new Outage(latestPing.timeResponseReceived, this.lastDateConnected, target.IPV4))
	// }

	updateTargetsConnectionStatus(){

		for (let target of this.pingTargets){
			let latestPing = this.latestPing(target)

			let anyResponse = latestPing && (typeof latestPing.roundTripTimeMs === 'number' )
			let responseWithinThreshold = latestPing && (latestPing.roundTripTimeMs <= this.badLatencyThresholdMs)

			if (anyResponse && responseWithinThreshold){
				this.lastDateConnected = Date.now()
				return target.connected = connectionState.CONNECTED
			} else if ( latestPing && !latestPing.timeout ){
				return target.connected = connectionState.PENDING_RESPONSE
			} else {
				return target.connected = connectionState.DISCONNECTED
			}
			
			// console.log(target.userFacingName + ' connected?: ' + target.connected.humanName)
		}
	}

	latestPing(target){
		return target.pingList[target.pingList.length - 1]
	}

	writeSessionLog(){
		const combinedTargets = this.combineTargetsForExport()
		const content = JSON.stringify(combinedTargets)
		const fileCreationDate = new Date()
		
		// Turn ISO string into filesystem-compatible string (also strip milliseconds)
		const filename = MyUtil.isoDateToFileSystemName(fileCreationDate) + ' pingu log.json'

		fs.mkdir(this.logsDir)
		const fileUri = this.logsDir + '/' + filename 

		// Keep track of this session's log so we can come back and update it
		this.activeLogUri = fileUri

		return fsWriteFilePromise(fileUri, content, 'utf8').then((file)=>{
			console.log('Wrote log to ' + fileUri)
		}, (error)=>{
			console.error(error)
		})
	}

	// Write to this sessions existing log file
	updateSessionLog(){

		let onFileRead = (data)=>{
			let original = JSON.parse(data)

			let liveData = this.combineTargetsForExport()

			let latestPingInOriginal = _.sortBy(original.combinedPingList, ['timeResponseReceived', 'targetIPV4']).reverse()[0]

			// This assumes original has exact same structure as live data
			let firstUnwrittenPingIndex = original.combinedPingList.indexOf(latestPingInOriginal) + 1
			let firstUnwrittenPing = liveData.combinedPingList[firstUnwrittenPingIndex]
			
			let toWrite = _.cloneDeep(original)
			// Make sure there's any new pings *after* the most recently saved
			if ( !firstUnwrittenPing ){
				console.warn('No new pings found to update existing session\'s log with.')
				// Just update timestamp and re-save same data
				
			} else {
				let onlyNewPings = liveData.combinedPingList.slice(firstUnwrittenPingIndex)

				toWrite.combinedPingList = _.concat(original.combinedPingList, onlyNewPings)
				toWrite.combinedPingList = _.sortBy(toWrite.combinedPingList, ['timeResponseReceived', 'targetIPV4'])
			}
			toWrite.dateLogLastUpdated = new Date()
			toWrite = JSON.stringify(toWrite)
			
			return fsWriteFilePromise(this.activeLogUri, toWrite, 'utf8').then((file)=>{
				console.log('Updated log at ' + this.activeLogUri)
				return this.activeLogUri
			}, (error)=>{
				throw new Error(error) 
			})
		}

		return fsReadFilePromise(this.activeLogUri, 'utf8').then(onFileRead, (error)=>{
			throw new Error(error)
		})
	}

	combineTargetsForExport(){
		let exporter = {
			dateLogCreated: new Date(),
			dateLogLastUpdated: new Date(),
			sessionStartTime: this.sessionStartTime,
			targetList: _.cloneDeep(this.pingTargets),
			combinedPingList: []
		}

		// Remove ping lists from individual targets and concat them all into combinedPingList
		for (let target of exporter.targetList){
			for (let ping of target.pingList){
				// Add targetIPV4 to pings to identify their target now that they have no parent
				ping.targetIPV4 = target.IPV4
			}
			exporter.combinedPingList = _.concat(exporter.combinedPingList, target.pingList)
		}
		for (let target of exporter.targetList){
			delete target.pingList
			delete target.connected // "Connection" is live info and derived from pingList anyway
		}
		let pingListSorted = _.sortBy(exporter.combinedPingList, [(o)=>{return o.timeResponseReceived}, (o)=>{return o.targetIPV4}])
		exporter.combinedPingList = pingListSorted

		return exporter
	}

	tellArchiveSize(){
		getFolderSize(this.logsDir, (err, size)=>{
		  if (err) { throw err }
		 
		  const sizeInMB = (size / 1024 / 1024).toFixed(2)
		  console.log(`Archive size: ${sizeInMB} MB`)
		})
	}

	exportSessionToTextSummary(){
		// This will overwrite any file with the same session start time
		let summaryUri = this.logsDir + '/' + MyUtil.isoDateToFileSystemName(this.sessionStartTime) + ' pingu summary.txt'

		let template = `${this.appHumanName} - ${this.appHumanSubtitle}` + 
		`\n ${this.appHomepageUrl}` +
		`\n\nSession Log` +
		`\nSession started: ${moment(this.sessionStartTime).format('MMMM Do YYYY HH:MM:SS')}` +
		`\nPing interval time (in milliseconds): ${this.pingIntervalMs}` +
		`\nMaximum round-trip time before considering a connection bad (in milliseconds): ${this.badLatencyThresholdMs}` +
		`\nPing targets:`
		
		for (let target of this.pingTargets){
			template = template + '\n    - ' + target.userFacingName + ' (IP: ' + target.IPV4 + ')'
		}

		template = template + '\n\nTotal internet connection outages (when all target IP addresses took too long to respond):'

		if (this.outages.length >= 1){
			for (let outage of this.outages){
				template = template + '\n    - ' + moment(outage.startDate).format('MMMM Do YYYY HH:MM:SS') + ', duration: ' + outage.durationSec + ' seconds'
			}
		} else {
			template = template + '\n    [No outages]'
		}

		template = template + '\n\n All pings:'

		for (let ping of this.combineTargetsForExport().combinedPingList){
			template = template + '\n    - [' + moment(ping.timeResponseReceived).format('MMMM Do YYYY HH:MM:SS') + '] '
			template = template + 'IP ' + ping.targetIPV4 + ', '
			if (!ping.timeout){
				template = template + 'Round-trip time: ' + ping.roundTripTimeMs + ' ms, '
				template = template + 'Response size: ' + ping.responseSize + ' bytes, '	
				template = template + 'ICMP: ' + ping.icmpSeq + ', '
			} else {
				template = template + 'Responsed timed out, ICMP: ' + 'ICMP: ' + ping.timeoutIcmp
			}
		}

		return fsWriteFilePromise(summaryUri, template, 'utf8').then((file)=>{
			console.log('Wrote human-readable text summary to ' + summaryUri)
			return summaryUri
		}, (error)=>{
			throw new Error(error)
		})
	}

	compressLogToArchive(filename){
		
		fs.mkdirSync(this.archiveDir)
		const gzip = zlib.createGzip()
		const input = fs.createReadStream(this.logsDir + '/' + filename)
		const output = fs.createWriteStream(this.archiveDir + '/' + filename + '.gz')

		input.pipe(gzip).pipe(output)
	}

}

let app = new Pingu()


const regPingHandlers = (pingTarget)=>{
	console.log(`Registering ping handler for target: ${pingTarget.userFacingName} (${pingTarget.IPV4})`)

	const pingProcess = spawn('ping', [
		'-i', 
		app.pingIntervalMs / 1000, 
		pingTarget.IPV4
	]);

	pingProcess.stdout.on('data', (data)=>{
	  	// TEMP - TODO check if this is a junk message and if so discard or store differently
	  	let dataAppearsStructurable = true

	  	if (dataAppearsStructurable){
	  		let pingAsStructure = PingData.pingTextToStructure(data.toString(), new Date())

		  	pingTarget.pingList.push(new PingData(pingAsStructure))	
	  	} 
	  
	});

	pingProcess.stderr.on('data', (data)=>{
	  	pingTarget.pingErrorList.push(new PingError(data.toString(), new Date()))
	});

	pingProcess.on('close', (code)=>{
	  	console.log(`Child process (ping) exited with code ${code}`);
	});
}

for ( let pingTarget of app.pingTargets ){
	regPingHandlers(pingTarget)
}


app.tellArchiveSize()

let connectionStatusTick = setInterval(()=>{
	app.updateInternetConnectionStatus()
	console.log(moment().format('MMMM Do YYYY HH:MM:SS') + ' Internet connected?: ' + app.updateInternetConnectionStatus().humanName)
}, app.connectionStatusIntervalMs)

// POSSIBLE BUG: this runs almost assuming sync, not sure if need a flag or something to make sure not actively worked on
let writeToFileTick = setInterval(()=>{
	if ( app.activeLogUri ) { 
		console.log('Writing to file. Active log URI found, using that URI.')
		app.updateSessionLog()
	} else {
		console.log('Writing to new log file.')
		app.writeSessionLog() 
	}
}, app.writeToFileIntervalMs)


let exportSessionToTextSummaryTick = setInterval(()=>{
	app.exportSessionToTextSummary()
}, 10 * 1000)

let compressLogToArchiveTick = setInterval(()=>{
	app.compressLogToArchive(MyUtil.filenameFromUri(app.activeLogUri))
}, 20 * 1000)