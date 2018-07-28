class PingData {
	constructor(data){
		this.ttlMs = data.ttlMs
		this.roundTripTimeMs = data.roundTripTimeMs
		this.responseSize = data.responseSize
		this.icmpSeq = data.icmpSeq

		this.timeout = data.timeout // bool
		this.timeoutIcmp = data.timeoutIcmp // num

		this.timeResponseReceived = data.timeResponseReceived
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
}

class PingError {
	constructor(pingErrorText, timeResponseReceived){
		this.pingErrorText = pingErrorText
		this.timeResponseReceived = timeResponseReceived
	}
}

class Outage {
	constructor(startDate, endDate, targetIP){
		this.startDate = startDate
		this.endDate = endDate
		this.targetIP = targetIP
	}

	get durationSec(){
		return (this.endDate - this.startDate) / 1000
	}
}

exports.PingError = PingError
exports.PingData = PingData
exports.Outage = Outage