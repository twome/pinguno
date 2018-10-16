// 3rd-party
// import cloneDeep from '../node_modules/lodash-es/cloneDeep.js' // example of Lodash url
import Vue from '../node_modules/vue/dist/vue.esm.js'
import renderjson from '../node_modules/renderjson/renderjson.js'

// In-house
import { config } from './config.js'
import { d, w, c, ce, ci } from './util.js'
import { PingunoSession } from './pinguno-session.js'
import { customEls, registerDOMNodesToCustomEls } from './custom-el-reg.js' // Side-effects

let customElInstances = registerDOMNodesToCustomEls(customEls)

/* MODEL */

// Options
let opt = {
	renderVmTickIntervalMs: 1000
}

// State
let vm = {}
let fetchTimer = {}
let cachedVm = {} // TODO use iDB to save most recent view
let liveSession = null
let liveSessionJSONPollTick = null
let renderVmTick = null
let jsonOutputEl = document.querySelector('.c-json-output')

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
			})
		}
	}
})


/* INPUT */

let registerInputHandlers = ()=>{
	for (let el of d.querySelectorAll('.js-toggle-live-pinging')){
		el.addEventListener('click', e => {
			clearInterval(liveSessionJSONPollTick)
		})
	}
}



/* RENDERING */

// TEMP dev only
let simpleJSONRender = (parsedObj)=>{
	let existing = jsonOutputEl.querySelector('.renderjson')
	if (existing) jsonOutputEl.removeChild(existing)
	jsonOutputEl.appendChild(renderjson(parsedObj))
}

let renderVm = ()=>{
	let els = d.querySelectorAll('.c-short-stat')

	let defaultRenderFn = (propKey)=>{
		if (propKey !== undefined){
			let el = [...els].filter(el => el.dataset.statType === propKey)[0]
			el.querySelector('.c-short-stat__value').innerHTML = vm[propKey]
		}
	}

	let valuesToUpdate = {
		lowestUptime: vm.lowestUptime,
		lowestMeanGoodRTT: vm.lowestMeanGoodRTT,
	}

	for (let key of Object.keys(valuesToUpdate)){
		defaultRenderFn(key)
	}

	customElInstances.forEach((classedEl)=>{
		if (typeof classedEl.updateRender === 'function'){
			classedEl.updateRender(vm)
		}
	})
}


/* NETWORK */

let fetchAndParse = (jsonUrl)=>{
	return fetch(jsonUrl).then((res)=>{
		return res.json()
	}, (err)=>{
		return Error(err) // TEMP this should be graceful
	})
}

let onFetchedSession = session =>{
	fetchTimer.end = new Date()
	// console.info(`Session fetch took ${fetchTimer.end - fetchTimer.start}ms`)

	liveSession = new PingunoSession(session)
	vm.liveSession = liveSession
	vm.lowestUptime = liveSession.getLowestUptime()
	vm.lowestMeanGoodRTT = liveSession.getLowestMeanGoodRTT()
	simpleJSONRender(session)
}

let registerDataPolls = ()=>{
	// Fetch static/mock data for use in rendering
	let onLiveSessionJSONPoll = ()=>{
		fetchTimer.start = new Date()
		let fetched = fetchAndParse('/api/1/live-session')
		fetched.then(onFetchedSession, err => {
			throw Error(err)
		})
	}
	liveSessionJSONPollTick = setInterval(onLiveSessionJSONPoll, 2000)
	onLiveSessionJSONPoll()

	// fetchAndRender('/api/1/mock-session')
}

/*
	Kickoff
*/
ci('Running entry.js')
renderVmTick = setInterval(renderVm, 1000)
renderVm()
registerInputHandlers()
registerDataPolls()