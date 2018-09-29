// Built-in modules
const { spawn } = require('child_process')

// 3rd-party dependencies
const netPing = require('net-ping')

// In-house modules
const { config } = require('./config.js')
const { PingData, RequestError } = require('./ping-formats.js')


class EngineNative {
	constructor(){}

	// PRODUCTION TODO: Do this more thoroughly/securely (i.e. read up on it and use a tested 3rd-party lib)
	static sanitizeSpawnInput(intervalNumber, ipString){
		let ret = {}

		let pin = intervalNumber
		let ips = ipString

		let intervalOk = (pin === Number(pin)) && (typeof pin === 'number')
		if (intervalOk){
			ret.intervalNumber = Math.abs(Math.floor(pin))
		} else {
			throw Error('DANGER: this.opt.pingIntervalMs, which is used in node\'s command-line call \'spawn\', is not a number')
		}

		let nothingButDigitsAndDots = (ips.match(/[^\d\.]+/) === null)
		let ipOk = (typeof ips === 'string') && nothingButDigitsAndDots
		if (ipOk){
			ret.ipString = ips
		} else {
			throw Error('DANGER: this.opt.pingIntervalMs, which is used in node\'s command-line call \'spawn\', is not a number')
		}

		return ret
	}

	static regPingHandlersInbuilt(instance, pingTarget){
		console.info(`Registering inbuilt ping handler for target: ${pingTarget.humanName} (${pingTarget.IPV4})`)

		// TODO: hold onto each ICMP as it gets sent out and pair it up with a new Date(); 
		// attach it to its response/timeout when that comes back.
		// - How to do this in a stream-like way? Have a stack of ICMPs (w max size) that gets popped from in onResponse?

		let sanitizedSpawnInput = EngineNative.sanitizeSpawnInput(instance.opt.pingIntervalMs, pingTarget.IPV4)

		const pingProcess = spawn('ping', [
			'-i', 
			sanitizedSpawnInput.intervalNumber / 1000, // Mac ping -i supports fractional intervals but <= 0.1s requires su privilege 
			sanitizedSpawnInput.ipString
		])

		instance.firstPingSent = true

		pingProcess.on('error', (code, signal)=>{
			console.error('child process hit an error with ' + `code ${code} and signal ${signal}`)
			instance.sessionDirty = true
			throw Error('Node child process hit an error')
		})

		pingProcess.stdout.on('data', (data)=>{
			let dataStr = data.toString()
	  		let pingAsStructure = EngineNative.macOSPingTextToStructure(dataStr, new Date())
		  	pingTarget.pingList.push(new PingData(pingAsStructure))	
		  	instance.sessionDirty = true
		})

		pingProcess.stderr.on('data', (data)=>{
			let dataStr = data.toString()
			if ( config.nodeVerbose >= 3){
				console.error('inbuilt ping returned error through stderr: ', dataStr)
			} 

			// Defaults
			let errorReqTime = new Date()
			let errorResTime = new Date()
			let errorType = RequestError.errorTypes.unknownError
			// TODO: sort stderr errors into error types before storing
			if (dataStr.match(/No route to host/)){
				errorType = RequestError.errorTypes.destinationUnreachableError
			}

			pingTarget.requestErrorList.push(new RequestError(errorType, errorReqTime, errorResTime, dataStr))	
			instance.sessionDirty = true
		})

		pingProcess.on('close', (code)=>{
		  	console.info(`Child process (ping) closed with code ${code}`)
		})

		pingProcess.on('exit', (code)=>{
		  	console.info(`Child process (ping) exited with code ${code}`)
		})

		return true
	}

	// FRAGILE: Depends on particular structure of text output from macOS 10.12.6 Sierra's inbuilt `ping` binary
	static macOSPingTextToStructure(pingText, timeResponseReceived){
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
			structure.errorType = PingData.errorTypes.requestTimedOutError
			structure.icmpSeq = pingText.match(timeoutRegex) ? Number(pingText.match(timeoutRegex)[1]) : null
		}
		
		// Either way
		structure.timeResponseReceived = timeResponseReceived

		return structure
	}
}



class EngineNetPing {
	constructor(){}

	static regPingHandlersNetPing(instance, pingTarget){
		console.info(`Registering 'net-ping' handler for target: ${pingTarget.humanName} (${pingTarget.IPV4})`)

		let npOptions = {
			timeout: instance.opt.timeoutLimit,
			packetSize: instance.opt.pingPacketSizeBytes,
			ttl: instance.opt.pingOutgoingTtlHops
		}

		let npSession = netPing.createSession(npOptions)

		let currentIcmp = null
		let unpairedRequests = []

		let pingHost = (ipv4)=>{
			currentIcmp = currentIcmp === null ? 0 : currentIcmp + 1
			let contextIcmp = currentIcmp

			let req = {
				icmpSeq: contextIcmp,
				timeRequestSent: new Date()
			}
			unpairedRequests.push(req)

			let res = {
				failure: null,
				errorType: undefined
			}

			npSession.pingHost(ipv4, (err, target, sent, rcvd)=>{
				EngineNetPing.processNetPingResponse(err, target, sent, rcvd, req, res, unpairedRequests, pingTarget)
				instance.sessionDirty = true
			})
		}	

		npSession.on('error', (err)=>{
			console.error(err.toString())
			npSession.close()
			instance.sessionDirty = true

			throw Error('net-ping\'s underlying raw socket emitted an error')
		})

		let npPingChosenTarget = ()=>{
			instance.firstPingSent = true
			return pingHost(pingTarget.IPV4)
		}

		let targetPingingTick = setInterval(npPingChosenTarget, instance.opt.pingIntervalMs)

		return true
	}

	static processNetPingResponse(err, target, sent, rcvd, req, res, unpairedRequests, pingTarget){
		res.icmpSeq = req.icmpSeq // num
		res.timeRequestSent = sent // Date - can be undefined if error
		res.timeResponseReceived = rcvd // Date - can be undefined if error

		// TODO: this needs to account for errors that occur within/deeper than net-ping (try/catch?)
		if (err){
			res.failure = true
			for (let supportedErrorStr of [
				'RequestTimedOutError',
				'DestinationUnreachableError',
				'PacketTooBigError',
				'ParameterProblemError',
				'RedirectReceivedError',
				'SourceQuenchError',
				'TimeExceededError'
			]){
				if (err instanceof netPing[supportedErrorStr]){
					let netPingToInternalError = {
						RequestTimedOutError: 'requestTimedOutError',
						DestinationUnreachableError: 'destinationUnreachableError',
						PacketTooBigError: 'packetTooBigError',
						ParameterProblemError: 'parameterProblemError',
						RedirectReceivedError: 'redirectReceivedError',
						SourceQuenchError: 'sourceQuenchError',
						TimeExceededError: 'timeExceededError'
					}
					// Convert between net-ping's and our own errors
					res.errorType = PingData.errorTypes[netPingToInternalError[supportedErrorStr]]
				} else {
					let handled = false

					// NB: Errors emitted from raw-socket when network adapter turned off on macOS
					// Should have been handled by netPing 
					if (err.toString().match(/No route to host/)){
						res.errorType = PingData.errorTypes.destinationUnreachableError
						handled = true
					}
					if (err.toString().match(/Network is down/)){
						res.errorType = PingData.errorTypes.networkDownError
						handled = true
					}

					if (!handled){
						// Unknown misc error
						console.error('processNetPingResponse: Unknown net-ping response error:')
						console.error(err)

						res.errorType = PingData.errorTypes.unknownError
						// PRODUCTION TODO: take this throw out; more important to stay running than identify unhandled errors
						if (process.env.NODE_ENV === 'development'){
							console.error(err)
							throw Error('processNetPingResponse - Unhandled error:', err)	
						}	
					}
					
				}
			}
			pingTarget.pingList.push(new PingData(res))

		} else {
			// Successful response
			res.failure = false
			res.roundTripTimeMs = rcvd - sent // num - we only bother to calc if both vals are truthy
			// TODO: how to get response size in net-ping? seems impossible
			// TODO: how to get response ttl in net-ping (it's not the same as request ttl)? seems impossible
			
			pingTarget.pingList.push(new PingData(res))
		}

		for (let requestIndex in unpairedRequests){
			if (unpairedRequests[requestIndex].icmpSeq === res.icmpSeq){
				unpairedRequests.splice(requestIndex, 1)
			}
		}

		// TEMP
		if (unpairedRequests.length > 10){
			console.debug('=== Unpaired requests piling up...')
			console.debug(unpairedRequests)
		}

		return {
			req: req,
			res: res,
			unpairedRequests: unpairedRequests
		}
	}
}

exports.EngineNative = EngineNative
exports.EngineNetPing = EngineNetPing