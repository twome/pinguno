/* eslint no-console: 0 */
console.log('Custom client reloading enabled. Polling...')
let sequentialFailures = 0
let hugeConsoleAlertStyle = 'background: hsla(0, 20%, 5%, 1); color: hsla(0, 100%, 90%, 1); padding: 1em; font-size: 2em;'

let liveReloadTick = ()=>{
	fetch('/api/1/util/client-code-obsoleted').then((res)=>{
		res.text().then(responseText => {
			if (responseText === 'true'){
				// `true` makes it a forced reload; ignore cache
				fetch('/api/1/util/client-code-obsoleted', {
					method: 'PUT',
					body: 'false'
				}).then(res => {
					console.warn('%c BROWSER CLIENT CODE OBSOLETE -- REFRESHING PAGE NOW.', hugeConsoleAlertStyle)
					clearInterval(liveReloadTick)
					location.reload(true)
				})
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