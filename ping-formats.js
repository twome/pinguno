// In-house modules
const { Enum } = require('./enum.js')

class PingData {
	constructor(data){
		this._class = 'PingData'

		this.ttlHops = data.ttlHops // num
		this.roundTripTimeMs = data.roundTripTimeMs // num
		this.responseSize = data.responseSize // num
		this.icmpSeq = data.icmpSeq // num

		this.timeRequestSent = data.timeRequestSent // Date
		this.timeResponseReceived = data.timeResponseReceived // Date

		this.errorType = data.errorType || null
		this.failure = (data.failure === true || data.failure === false) ? data.failure : undefined 
	}

	static get errorTypes(){
		return new Enum([
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
			},{
				accessor: 'networkDownError',
				humanName: 'Local network is down (caused by raw-socket)'
			},{
				accessor: 'unknownError',
				humanName: 'Error with unknown cause / handling'
			}
		])
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'timeResponseReceived' },
			{ typeClass: Date, propKey: 'timeRequestSent' },
			{ propKey: 'errorType', reviveFn: (simpleParseData)=>{
				return PingData.errorTypes[simpleParseData.accessor] // Cast to enum
			}}
		]
	}
}

class RequestError {
	constructor(errorType, timeRequestSent, timeResponseReceived, errorData){
		this._class = 'RequestError'

		this.errorData = errorData
		this.errorType = errorType
		this.timeRequestSent = timeRequestSent
		this.timeResponseReceived = timeResponseReceived // OK for this to be undefined
	}

	static get errorTypes(){
		return new Enum([
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
			},{
				accessor: 'unknownError',
				humanName: 'Error with unknown cause / handling'
			}
		])
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'timeResponseReceived' },
			{ typeClass: Date, propKey: 'timeRequestSent' },
			{ propKey: 'errorType', reviveFn: (simpleParseData)=>{
				return RequestError.errorTypes[simpleParseData.accessor] // Cast to enum
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
		this.sessionEndTime = obj.sessionEndTime
		this.targetList = obj.targetList
	}

	get revivalPropTypes(){
		return [
			{ typeClass: Date, propKey: 'dateLogCreated' }, 
			{ typeClass: Date, propKey: 'dateLogLastUpdated' },
			{ typeClass: Date, propKey: 'sessionStartTime' },
			{ typeClass: Date, propKey: 'sessionEndTime' }
		]
	}
}

exports.RequestError = RequestError
exports.PingData = PingData
exports.Outage = Outage
exports.TargetOutage = TargetOutage
exports.PingsLog = PingsLog