class PingData {
	constructor(data){
		this._class = 'PingData'

		this.ttlHops = data.ttlHops // num
		this.roundTripTimeMs = data.roundTripTimeMs // num
		this.responseSize = data.responseSize // num
		this.icmpSeq = data.icmpSeq // num

		this.timeRequestSent = data.timeRequestSent // Date
		this.timeResponseReceived = data.timeResponseReceived // Date

		this.errorTypes = new Enum([
			{
				accessor: 'requestTimedOutError',
				humanName: 'Request timed out (spent too long waiting for a response from the server)'
			},{
				accessor: 'destinationUnreachableError',
				humanName: 'Destination unreachable'
			},{
				accessor: 'packetTooBigError',
				humanName: 'Packet size too big' // TODO: too big for server or ping client?
			},{
				accessor: 'parameterProblemError',
				humanName: 'Parameter problem (???)' // TODO: What parameters? Where did problem occur?
			},{
				accessor: 'redirectReceivedError',
				humanName: 'Received a redirect' // TODO: On the way to the intended server or on the way back?
			},{
				accessor: 'sourceQuenchError',
				humanName: 'Source quench (???)' // TODO: What is this?
			},{
				accessor: 'timeExceededError', // TODO: What time?
				humanName: 'Time exceeded'
			}
		])
		this.errorType = data.errorType || null
		this.failure = (data.failure === true || data.failure === false) ? data.failure : undefined 
	}

	// FRAGILE: Depends on particular structure of text output from macOS 10.12.6 Sierra's inbuilt `ping` binary. 
	/*
		Solution: distribute with specific binary, or replace this part with a `ping` 
		substitute that gives out structured data instead of text.
	*/
	static pingTextToStructure(pingText, timeResponseReceived){
		const structure = {}

		const roundTripTimeMsRegex = /time\=([\.\d]*) ms/
		const ttlHopsRegex = /ttl\=([\.\d]*) /
		const icmpSeqRegex = /icmp_seq\=([\.\d]*) /
		const responseSizeRegex = /([\.\d]*) bytes from/

		const timeoutRegex = /Request timeout for icmp_seq (\d*)/

		// Successful connection
		structure.roundTripTimeMs = pingText.match(roundTripTimeMsRegex) ? Number(pingText.match(roundTripTimeMsRegex)[1]) : null
		structure.ttlHops = pingText.match(ttlHopsRegex) ? Number(pingText.match(ttlHopsRegex)[1]) : null
		structure.icmpSeq = pingText.match(icmpSeqRegex) ? Number(pingText.match(icmpSeqRegex)[1]) : null
		structure.responseSize = pingText.match(responseSizeRegex) ? Number(pingText.match(responseSizeRegex)[1]) : null
		
		// No connection
		if (pingText.match(timeoutRegex)){
			structure.failure = true
			structure.errorType = this.errorTypes.requestTimedOutError
			structure.icmpSeq = pingText.match(timeoutRegex) ? Number(pingText.match(timeoutRegex)[1]) : null
		}
		
		// Either way
		structure.timeResponseReceived = timeResponseReceived

		return structure
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'timeResponseReceived' },
			{ typeClass: Date, propKey: 'timeRequestSent' },
			{ propKey: 'errorType', reviveFn: (simpleParseData)=>{
				return this.errorTypes[simpleParseData.accessor] // Cast to enum
			}}
		]
	}
}

class RequestError {
	constructor(errorType, timeRequestSent, timeResponseReceived){
		this._class = 'RequestError'

		this.errorTypes = new Enum([
			// Most of these error names/descriptions taked from `net-ping` package
			{
				accessor: 'destinationUnreachableError',
				humanName: 'Destination unreachable'
			},{
				accessor: 'packetTooBigError',
				humanName: 'Packet size too big' // TODO: too big for server or ping client?
			},{
				accessor: 'parameterProblemError',
				humanName: 'Parameter problem (???)' // TODO: What parameters? Where did problem occur?
			},{
				accessor: 'redirectReceivedError',
				humanName: 'Received a redirect' // TODO: On the way to the intended server or on the way back?
			},{
				accessor: 'sourceQuenchError',
				humanName: 'Source quench (???)' // TODO: What is this?
			},{
				accessor: 'timeExceededError', // TODO: What time?
				humanName: 'Time exceeded'
			}
		])

		this.errorType = errorType
		this.timeRequestSent = timeRequestSent
		this.timeResponseReceived = timeResponseReceived // OK for this to be undefined
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'timeResponseReceived' },
			{ typeClass: Date, propKey: 'timeRequestSent' },
			{ propKey: 'errorType', reviveFn: (simpleParseData)=>{
				return this.errorTypes[simpleParseData.accessor] // Cast to enum
			}}
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


class PingsLog {
	constructor(obj){
		this._class = 'PingsLog'

		this.dateLogCreated = new Date()
		this.dateLogLastUpdated = new Date()
		this.combinedPingList = []

		this.outages = obj.outages
		this.sessionStartTime = obj.sessionStartTime
		this.targetList = obj.targetList
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'dateLogCreated' }, 
			{ typeClass: Date, propKey: 'dateLogLastUpdated' },
			{ typeClass: Date, propKey: 'sessionStartTime' }
		]
	}
}

exports.RequestError = RequestError
exports.PingData = PingData
exports.Outage = Outage
exports.TargetOutage = TargetOutage
exports.PingsLog = PingsLog