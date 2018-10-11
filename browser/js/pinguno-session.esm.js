import { collectPropertyAcrossInstancesDeep } from './util.esm.js'

class PingunoSession {
	constructor(dataObj){
		Object.assign(this, dataObj)
		this.data = dataObj
	}

	getValPerTargetForStatKey(statKey){
		let targets = Object.keys(this.data.sessionStats).map(key => this.data.sessionStats[key])
		return collectPropertyAcrossInstancesDeep(targets, [statKey])
	}

	getLowestUptime(){
		let uptimes = this.getValPerTargetForStatKey('uptimeFraction')
		let lowest = Math.min(...uptimes)
		let asPercent = 100 * lowest
		let toTwoPlaces = (Math.round(asPercent * 100) / 100).toFixed(2)
		return toTwoPlaces
	}

	getLowestMeanGoodRTT(){
		let mgrs = this.getValPerTargetForStatKey('meanGoodRTT')
		let lowest = Math.min(...mgrs)
		let toNearestMs = Math.round(lowest)
		return toNearestMs
	}
}

export { PingunoSession }