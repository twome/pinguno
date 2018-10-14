let { DateTime } = require('../node_modules/luxon/build/cjs-browser/luxon.js')

/* eslint no-console: 0 */
console.log('Custom client reloading enabled. Polling...')
let sequentialFailures = 0
let hugeConsoleAlertStyle = 'background: hsla(0, 20%, 5%, 1); color: hsla(0, 100%, 90%, 1); padding: 1em; font-size: 2em;'
let clientLastRefreshedDate = new Date()
let defaultPort = '1918'
let defaultHost = `http://127.0.0.1:${defaultPort}`

let liveReloadTick = ()=>{
	fetch(`/dev/client-code-last-modified`).then((res)=>{
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
		if (sequentialFailures >= 3){
			clearInterval(liveReloadTick)
			console.warn(`Live reload failed to connect ${sequentialFailures} times in a row; assuming the server's down.`)
		}
	})
}
setInterval(liveReloadTick, 1000)