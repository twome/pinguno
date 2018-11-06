/* eslint no-console: 0 */
import throttle from '../node_modules/lodash-es/throttle.js'

let { DateTime } = require('../node_modules/luxon/build/cjs-browser/luxon.js')

// Options
let hugeConsoleAlertStyle = 'background: hsla(0, 20%, 5%, 1); color: hsla(0, 100%, 90%, 1); padding: 1em; font-size: 2em;'
let defaultLiveReloadPath = '/dev/client-code-last-modified'

// State
let clientLastRefreshedDate = new Date()
let sequentialFailures = 0
let nextPort = Number(location.port) + 1
let portToUse = nextPort + sequentialFailures
let fetchURL = new URL(defaultLiveReloadPath, location.protocol + '//' + location.hostname + ':' + portToUse)

let liveReloadTick = ()=>{
	if (sequentialFailures >= 5) return false
	fetch(fetchURL.href).then((res)=>{
		res.text().then(responseText => {
			if (!responseText){	return false }
			let resDate = DateTime.fromISO(responseText) && DateTime.fromISO(responseText).toJSDate()
			if (resDate && resDate >= clientLastRefreshedDate){ // Client update time is later than our last refresh
				console.warn('%c BROWSER CLIENT CODE OBSOLETE -- REFRESHING PAGE NOW.', hugeConsoleAlertStyle)
				clearInterval(liveReloadTick)
				clientLastRefreshedDate = new Date()
				location.reload(true) // `true` makes it a forced reload; ignore cache
			}
		})
	},(err)=>{
		sequentialFailures += 1
		if (sequentialFailures >= 5){
			clearInterval(liveReloadTick)
			console.warn(`Live reload failed to connect ${sequentialFailures} times in a row; assuming the server's down.`)
		} else {
			console.warn(`Live reload failed to connect to ${fetchURL.href} - trying again at port ${portToUse}`)
			// Try again at an incremented port
			liveReloadTick()
		}
	})
}
setInterval(liveReloadTick, 1000)

let restart = throttle(()=>{
	sequentialFailures = 0
	setInterval(liveReloadTick, 1000)
}, 1000)

// If we detect user activity, try and restart the live reloading connection attempts
document.addEventListener('focusin keydown scroll', ()=>{
	restart()
})