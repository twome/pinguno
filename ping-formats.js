class PingData {
	constructor(data){
		this._class = 'PingData'

		this.ttlMs = data.ttlMs // num
		this.roundTripTimeMs = data.roundTripTimeMs // num
		this.responseSize = data.responseSize // num
		this.icmpSeq = data.icmpSeq // num

		this.timeout = data.timeout // bool
		this.timeoutIcmp = data.timeoutIcmp // num

		this.timeResponseReceived = data.timeResponseReceived // Date
	}

	// FRAGILE: Depends on particular structure of text output from `ping` binary. 
	/*
		Solution: distribute with specific binary, or replace this part with a `ping` 
		substitute that gives out structured data instead of text.
	*/
	static pingTextToStructure(pingText, timeResponseReceived){
		const structure = {}

		const roundTripTimeMsRegex = /time\=([\.\d]*) ms/
		const ttlMsRegex = /ttl\=([\.\d]*) /
		const icmpSeqRegex = /icmp_seq\=([\.\d]*) /
		const responseSizeRegex = /([\.\d]*) bytes from/

		const timeoutRegex = /Request timeout for icmp_seq (\d*)/

		// Successful connection
		structure.roundTripTimeMs = pingText.match(roundTripTimeMsRegex) ? Number(pingText.match(roundTripTimeMsRegex)[1]) : null
		structure.ttlMs = pingText.match(ttlMsRegex) ? Number(pingText.match(ttlMsRegex)[1]) : null
		structure.icmpSeq = pingText.match(icmpSeqRegex) ? Number(pingText.match(icmpSeqRegex)[1]) : null
		structure.responseSize = pingText.match(responseSizeRegex) ? Number(pingText.match(responseSizeRegex)[1]) : null
		
		// No connection
		structure.timeout = !! pingText.match(timeoutRegex)
		structure.timeoutIcmp = pingText.match(timeoutRegex) ? Number(pingText.match(timeoutRegex)[1]) : null
		
		// Either way
		structure.timeResponseReceived = timeResponseReceived

		return structure
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'timeResponseReceived' }
		]
	}
}

class PingError {
	constructor(pingErrorText, timeResponseReceived){
		this._class = 'PingError'

		this.pingErrorText = pingErrorText
		this.timeResponseReceived = timeResponseReceived
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'timeResponseReceived' }
		]
	}
}

// TODO: extend from Outage?
class TargetOutage {
	constructor(pingList){
		this._class = 'TargetOutage'

		if ( !(pingList instanceof Array && pingList.length >= 1)){
			throw Error('pingList is not a valid array: ' + pingList) 
		}

		this.pingList = pingList

		this.contemporaries = []
	}

	get startDate(){
		return this.pingList[0].timeResponseReceived
	}

	get endDate(){
		return this.pingList[this.pingList.length - 1].timeResponseReceived
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'startDate' }, 
			{ typeClass: Date, propKey: 'endDate' }
		]
	}
}

class Outage {
	constructor(startDate, endDate){
		this._class = 'Outage'

		this.startDate = startDate
		this.endDate = endDate
	}

	get durationSec(){
		return (this.endDate - this.startDate) / 1000
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'startDate' }, 
			{ typeClass: Date, propKey: 'endDate' }
		]
	}
}

exports.PingError = PingError
exports.PingData = PingData
exports.Outage = Outage
exports.TargetOutage = TargetOutage