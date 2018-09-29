// Built-in modules
// const { spawn } = require('child_process')

// 3rd-party dependencies
const { _ } = require('lodash')

// In-house modules
const { config } = require('./config.js')
const { Outage, TargetOutage } = require('./ping-formats.js')


let isBadResponse = (ping, latencyAccuracyMargin)=>{
 	return ping.failure || (ping.errorType || ping.roundTripTimeMs > latencyAccuracyMargin)
}

let	isRoughlyWithinTimeframe = (dateToTest, timeframeStart, timeframeEnd, leniencyMs)=>{
	for (let param of [dateToTest, timeframeStart, timeframeEnd]){
		if ( (! param instanceof Date) || (! typeof param.getTime === 'function') ){
			throw Error('isRoughlyWithinTimeframe - param ' + param + 'is not a Date object')
		}
	}

	dateToTest = dateToTest.getTime() // convert to total UTC ms since epoch for comparison
	timeframeStart = timeframeStart.getTime()
	timeframeEnd = timeframeEnd.getTime()

	let isAfterStart = dateToTest >= ( timeframeStart - leniencyMs )
	let isBeforeEnd = dateToTest <= ( timeframeEnd + leniencyMs )
	return isAfterStart && isBeforeEnd
}

let fullOutagesAcrossTargets = (targets, timeframeLeniencyMs)=>{
	// Add TargetOutages (streaks of bad-response pings) to each target
	for (let target of targets){
		target.targetOutages = []
		let currentStreak = []
		// Assumes list is chronological
		for (let ping of target.pingList){
			if (isBadResponse(ping, timeframeLeniencyMs)){
				currentStreak.push(ping)
				if (ping === _.last(target.pingList) ){
					target.targetOutages.push(new TargetOutage(currentStreak))
					currentStreak = []
				}
			} else {
				if ( currentStreak.length >= 1){
					target.targetOutages.push(new TargetOutage(currentStreak))	
				}
				currentStreak = []
			}
		}
	}

	let fullOutages = []
	let baseTarget = targets[0]
	let checkingTarget

	if (targets.length === 1){
		// There are no other targets that need to have concurrent outages, so every target outage is a full outage
		let fullOutages = baseTarget.targetOutages
		return { fullOutages, targets }
	}
	
	for (let baseTargetOutage of baseTarget.targetOutages){

		// Min/max times this current outage could be (bound by current single-target outage)
		let thisOutageExtremes = {
			start: baseTargetOutage.startDate,
			end: baseTargetOutage.endDate
		}

		let checkOutageListWithinExtremes = function(targetOutageList, extremes){
			let targetOutagesThatIntersectExtremes = []

			for (let targetOutage of targetOutageList){
				let pingsWithinExtremes = []

				for (let ping of targetOutage.pingList){

					if (isRoughlyWithinTimeframe(ping.timeResponseReceived, extremes.start, extremes.end, timeframeLeniencyMs)){
						// If we haven't already pushed this TO to list of extremes, then do so
						if (targetOutagesThatIntersectExtremes.indexOf(targetOutage) <= -1){ 
							targetOutagesThatIntersectExtremes.push(targetOutage) 
						}
						pingsWithinExtremes.push(ping)
					}
				}

				if (pingsWithinExtremes.length === 0 ){
					// This TargetOutage doesn't intersect with the current full-outage's time boundaries; try the next one.  
					continue
				}

				// FRAGILE: this assumes pings are already in chron order
				thisOutageExtremes.start = pingsWithinExtremes[0].timeResponseReceived
				thisOutageExtremes.end = _.last(pingsWithinExtremes).timeResponseReceived

				// Within this TargetOutage, if there's an intersection with the current extremes, dive one level deeper
				if (pingsWithinExtremes.length >= 1){
					if (checkingTarget === _.last(targets)){
						// We're at the last target within this time-span
						fullOutages.push(new Outage(thisOutageExtremes.start, thisOutageExtremes.end))
					} else {
						checkingTarget = targets[targets.indexOf(checkingTarget) + 1]
						checkOutageListWithinExtremes(checkingTarget.targetOutages, thisOutageExtremes)
					}
				}
			}		
		}

		// Initiate checking each subsequent target for this outage
		checkingTarget = targets[targets.indexOf(baseTarget) + 1]
		checkOutageListWithinExtremes(checkingTarget.targetOutages, thisOutageExtremes)
	}

	return { fullOutages, targets } 
}

exports.fullOutagesAcrossTargets = fullOutagesAcrossTargets
exports.isBadResponse = isBadResponse
exports.isRoughlyWithinTimeframe = isRoughlyWithinTimeframe