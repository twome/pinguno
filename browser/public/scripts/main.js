// Convenience / shorthands
let d = document

let jsonOutputEl = document.querySelector('.json-output')

let simpleJsonRender = (parsedObj, sourceUrl)=>{
	jsonOutputEl.appendChild( renderjson(parsedObj) )
}

let fetchAndRender = (jsonUrl)=>{
	fetch(jsonUrl).then((res)=>{
		res.json().then((parsed)=>{
			simpleJsonRender(parsed)	
		})
	}, (err)=>{
		throw Error(err)
	})
}

// Fetch static/mock data for use in rendering
// fetchAndRender('/api/1/mock-session')
fetchAndRender('/api/1/live-session')

let liveSessionJSONPollTick = null
let startLiveSessionJSONPoll = ()=>{
	liveSessionJSONPollTick = setInterval(()=>{
		fetchAndRender('/api/1/live-session')
		let existingRenderEl = jsonOutputEl.querySelector('.renderjson')
		jsonOutputEl.removeChild(existingRenderEl)
	}, 2000)
}
startLiveSessionJSONPoll()

for (let el of d.querySelectorAll('.js-toggle-live-pinging, .renderjson a')){
	el.addEventListener('click', e => {
		clearInterval(liveSessionJSONPollTick)
	})
}