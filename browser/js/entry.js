// 3rd-party
// import cloneDeep from '../node_modules/lodash-es/cloneDeep.js' // example of Lodash url
import renderjson from '../node_modules/renderjson/renderjson.js'

// In-house
import { config } from './config.js'
import { d, w, c, ce, ci } from './util.js'
import { PingunoSession } from './pinguno-session.js'
import { registerDOMNodesToCustomEls } from './custom-el-reg.js' // Side-effects
import { ReactiveVm } from './reactive-vm.js' // Side-effects

// Web Components (custom elements)
import { Indicator } from './components/indicator.js'
import { MoreOptionsBtn } from './components/more-options-btn.js'

let vm = new ReactiveVm({
	el: '#reactive-vm-app',
	data: { // exposed to all custom el templates
		lowestUptime: 69.69,
		exportButtons: {
			'js-open-log-json': {
				name: `js-open-log-json`,
				description: `Open JSON log in text editor`
			},
			'js-open-log-json-this-session': {
				name: `js-open-log-json-this-session`,
				description: `Open this session's JSON log in text editor`
			},
			'js-compress-all-logs': {
				name: `js-compress-all-logs`,
				description: `Compress all JSON logs, copy zip file's path`
			}
		},
		activeServer: {
			hostname: 'localhost',
			port: '1919'
		}
	},
	methods: { // callable from vm-on-change, vm-on-click etc
		openCurrentLogJSON: ()=>{
			fetch('/api/1/actions/open-current-log-json', {
				method: 'GET'
			})
		}
	}
})

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
		console.debug(this.customElClasses)

		this.fetchTimer = {}
		this.liveSession = null
		this.liveSessionJSONPollTick = null
		this.renderVmTick = null
		
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
		if (config.verbose >= 2) console.info(`Session fetch took ${this.fetchTimer.end - this.fetchTimer.start}ms`)
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
			fetched.then(this.onFetchedSession, err => {
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
ci('Running entry.js')

let gui = new PingunoGUI()
gui.registerDataPolls()