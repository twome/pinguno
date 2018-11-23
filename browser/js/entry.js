// 3rd-party
import renderjson from '../node_modules/renderjson/renderjson.js'
import cloneDeep from '../node_modules/lodash-es/cloneDeep.js'

// In-house
import { config } from './config.js'
import './compatibility.js'
import { d, w, c, ce, ci, cred, cyel, cblu, cblk, cgrn, info3 } from './util.js'
import { PingunoSession } from './pinguno-session.js'
import { registerDOMNodesToCustomEls } from './custom-el-reg.js' 
import { ReactiveProxy, Watcher } from '../../reactive-object/reactive-object.js'

// Web Components (custom elements)
import { Indicator } from './components/indicator.js'
import { MoreOptionsBtn } from './components/more-options-btn.js'

import './test/reactive-proxy-spec.js'

class PingunoGUI {
	constructor({...options} = {
		renderVmTickIntervalMs: 1000
	}){
		this.opt = {...options}  // Bind constructor options to the instance

		// State
		this.customElClasses = [
			MoreOptionsBtn,
			Indicator
		]

		this.fetchTimer = {}
		this.liveSession = null
		this.liveSessionJSONPollTick = null
		this.renderVmTick = null

		this.vm = {}
	}


	// USER INPUT

	registerInputHandlers(){
		for (let el of d.querySelectorAll('.js-toggle-live-pinging')){
			el.addEventListener('click', e => {
				clearInterval(this.liveSessionJSONPollTick)
			})
		}
	}



	// RENDERING

	simpleJSONRender(parsedObj){
		let jsonOutputEl = document.querySelector('.c-json-output')

		let existing = jsonOutputEl.querySelector('.renderjson')
		if (existing) jsonOutputEl.removeChild(existing)
		jsonOutputEl.appendChild(renderjson(parsedObj))
	}



	// NETWORK

	fetchAndParse(jsonUrl){
		return fetch(jsonUrl).then((res)=>{
			return res.json()
		}, (err)=>{
			return Error(err) // TEMP this should be graceful
		})
	}

	onFetchedSession(session){
		this.fetchTimer.end = new Date()
		if (config.verbose >= 4) info3(`Session fetch took ${this.fetchTimer.end - this.fetchTimer.start}ms`)
		this.liveSession = new PingunoSession(session)
		
		this.vm.liveSessionLoaded = Object.keys(this.liveSession).length >= 1
		this.vm.lowestUptime = this.liveSession.getLowestUptime()
		this.vm.lowestMeanGoodRTT = this.liveSession.getLowestMeanGoodRTT()
		this.simpleJSONRender(session)
	}

	registerDataPolls(){
		// Fetch static/mock data for use in rendering
		let onLiveSessionJSONPoll = ()=>{
			this.fetchTimer.start = new Date()
			let fetched = this.fetchAndParse('/api/1/live-session')
			fetched.then((session)=>{
				this.onFetchedSession(session)
			}, err => {
				throw Error(err)
			})
		}
		this.liveSessionJSONPollTick = setInterval(onLiveSessionJSONPoll, 2000)
		onLiveSessionJSONPoll()
	}
}

/*
	Kickoff
*/
if (config.verbose >= 3) ci('Running entry.js')

let gui = new PingunoGUI()
gui.registerDataPolls()