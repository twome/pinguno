// Built-in modules
// (none)

// 3rd-party dependencies
const { _ } = require('lodash')
const simpleStatistics = require('simple-statistics')

// In-house modules
const { config } = require('./config.js')
const { isBadResponse } = require('./outages.js')

// TODO: better way of managing user configs for stats
let statsConfig = {		
	rttBinSize: 5 // Number in ms
}

class Stats {
	constructor(){
	
	}

	static calcSessionStats(instancePinguno){
		let session = instancePinguno
		let sessionStats = {}

		// BUG: doesn't handle negatives properly
		let toNearestMultipleOf = (input, factor)=>{
			if (typeof input !== 'number' || typeof factor !== 'number'){
				throw Error(`toNearestMultipleOf - inputs need to be numbers`)
			}

			// TODO: properly handle negativity
			let inputIsNegative = input < 0
			input = Math.abs(input)

			let halfFactor = factor / 2
			if (input < halfFactor){ 
				return 0 
			} else if (input >= halfFactor && input < factor){ 
				return factor 
			} else if (input > factor){
				let remainder = input % factor
				if (remainder >= halfFactor){
					return input - remainder + factor
				} else if (remainder < halfFactor){
					return input - remainder
				}
			}

			return inputIsNegative ? -input : input
		}

		for (let target of session.pingTargets){
			let thisStatTarget = {}

			if (target.pingList.length <= 0){
				console.warn(`calcSessionStats - no pings for target ${target.IPV4}`)
				thisStatTarget = null
			} else {
				let sortedPings = _.sortBy(target.pingList, (ping)=> ping.icmpSeq)
				let rTTs = sortedPings.map(val => val.roundTripTimeMs)
				let successfulRTTs = rTTs.filter(val => val)
				let successfulRTTsBinned = successfulRTTs.map(val => toNearestMultipleOf(val, statsConfig.rttBinSize))
				let badResponses = sortedPings.filter( val => {
					return isBadResponse(val)
				})

				thisStatTarget.meanGoodRTT = successfulRTTs.length > 0 ? _.mean(successfulRTTs) : null
				thisStatTarget.modeGoodRTT = successfulRTTsBinned.length > 0 ? simpleStatistics.mode(successfulRTTsBinned) : null
				thisStatTarget.medianGoodRTT = successfulRTTs.length > 0 ? simpleStatistics.median(successfulRTTs) : null
				thisStatTarget.maxGoodRTT = successfulRTTs.length > 0 ? successfulRTTs.reduce((a, b) => Math.max(a, b)) : null
				thisStatTarget.minGoodRTT = successfulRTTs.length > 0 ? successfulRTTs.reduce((a, b) => Math.min(a, b)) : null
				thisStatTarget.uptimeFraction = 1 - (badResponses.length / target.pingList.length)
			}

			sessionStats[target.IPV4] = thisStatTarget
		}

		return sessionStats
	}
}

exports.Stats = Stats