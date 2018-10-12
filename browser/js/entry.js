// 3rd-party
import cloneDeep from '../node_modules/lodash-es/cloneDeep.js'
let _ = { cloneDeep }
for (let key of Object.keys(_)){ if (typeof window[key] === 'function') delete window[key] } // Clean lodash methods off the global scope
import Vue from '../node_modules/vue/dist/vue.esm.js'
import renderjson from '../node_modules/renderjson/renderjson.js'

// In-house
import { PingunoSession } from './pinguno-session.esm.js'
import { MoreOptionsBtn } from './components/more-options-btn.esm.js' // Side-effects

// Convenience / shorthands
let d = document
let c = console.log.bind(console)
let cw = console.warn.bind(console)
let cdb = console.debug.bind(console)
let ci = console.info.bind(console)
let ce = console.error.bind(console)

// Options
let opt = {
	renderVmTickIntervalMs: 1000
}

// State
let vm = {} // TEMP Legacy / backup viewmodel (instead of Vue)
let fetchTimer = {}
let cachedVm = {} // TODO use iDB to save most recent view
let liveSession = null
let liveSessionJSONPollTick = null
let renderVmTick = null
let jsonOutputEl = document.querySelector('.json-output')
let customEls = [
	MoreOptionsBtn
]

// Get a reference to the "classed" version of every instance (DOM element) of each custom element we've made
let customElInstances = new Map()
for (let customEl of customEls){
	customElInstances.set(customEl, [])
	let instancesForElType = customElInstances.get(customEl)
	d.querySelectorAll(customEl.selector).forEach(el => {
		let classedEl = new MoreOptionsBtn(el)
		instancesForElType.push(classedEl)
		customElInstances.set(customEl, instancesForElType)
	})	
}

let vue = new Vue({
	el: '#vue-app',
	data: {
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
	methods: {
		openCurrentLogJSON: ()=>{
			fetch('/api/1/actions/open-current-log-json', {
				method: 'GET'
			}).then((res)=>{
				console.debug('fetch open current log json')
				console.debug(res)
			})
		}
	}
})

let fetchAndParse = (jsonUrl)=>{
	return fetch(jsonUrl).then((res)=>{
		return res.json()
	}, (err)=>{
		throw Error(err) // TEMP this should be graceful
	})
}

let updateIndicators = ()=>{
	let indicatorEls = d.querySelectorAll('.indicator')
	indicatorEls.forEach(el => {
		let hideEl = el => el.classList.add('invisible')
		if (el.dataset.indicatorType === 'browserClientCodeLoading'){
			hideEl(el)
			// This is already executing after .onPageReady
		}

		if (el.dataset.indicatorType === 'waitingForServerResponse'){
			if (liveSession) hideEl(el)
		}
	}) 
}

let onFetchedSession = session =>{
	fetchTimer.end = new Date()
	// console.info(`Session fetch took ${fetchTimer.end - fetchTimer.start}ms`)

	liveSession = new PingunoSession(session)
	vm.lowestUptime = liveSession.getLowestUptime()
	vm.lowestMeanGoodRTT = liveSession.getLowestMeanGoodRTT()
	simpleJSONRender(session)
}

// TEMP dev only
let simpleJSONRender = (parsedObj)=>{
	let existing = jsonOutputEl.querySelector('.renderjson')
	if (existing) jsonOutputEl.removeChild(existing)
	jsonOutputEl.appendChild(renderjson(parsedObj))
}

let registerDataPolls = ()=>{
	// Fetch static/mock data for use in rendering
	let onLiveSessionJSONPoll = ()=>{
		fetchTimer.start = new Date()
		fetchAndParse('/api/1/live-session').then(onFetchedSession).catch(err => {throw Error(err)})
	}
	liveSessionJSONPollTick = setInterval(onLiveSessionJSONPoll, 2000)
	onLiveSessionJSONPoll()

	// fetchAndRender('/api/1/mock-session')
}

let registerInputHandlers = ()=>{
	for (let el of d.querySelectorAll('.js-toggle-live-pinging, .renderjson a')){
		el.addEventListener('click', e => {
			clearInterval(liveSessionJSONPollTick)
		})
	}	

	d.addEventListener('keydown', e => {
		if (e.which === 27){ // Esc
			customElInstances.forEach(klass => {
				cdb(klass)
				// Elements which the user can "back out" of by eg. pressing <Esc>
				if (typeof klass.onEscape === 'function') klass.onEscape()
			})
			e.preventDefault()
		}
	})
}


let renderVm = ()=>{
	updateIndicators()
	let els = d.querySelectorAll('.short-stat')
	
	if (vm.lowestUptime){
		let el = [...els].filter(el => el.dataset.statType === 'lowestUptime')[0]
		el.querySelector('.short-stat__value').innerHTML = vm.lowestUptime
	}

	if (vm.lowestMeanGoodRTT){
		let el = [...els].filter(el => el.dataset.statType === 'lowestMeanGoodRTT')[0]
		el.querySelector('.short-stat__value').innerHTML = vm.lowestMeanGoodRTT
	}
}


/*
	Kickoff
*/
renderVmTick = setInterval(renderVm, 1000)
renderVm()
registerInputHandlers()
registerDataPolls()