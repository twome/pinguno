// side-effects: true
// DEVELOPMENT ONLY

// This is used for live-reloading (informing client that the code powering the client is obsolete, so refresh the URL to 
// update the client app).

const chokidar = require('chokidar')
const express = require('express')

let clientCodeLastModifiedStatusRoute = '/dev/client-code-last-modified'
let portClueRoute = '/dev/live-reload-port-clue'
let defaultLiveReloadPort = '2020'

let makeLiveReloadMiddleware = (clientCodeLastModified)=>{
	return function liveReloadMiddleware(req, res, next){ // Use trad functionn form to give a name to generatedMiddleware
		let sendBody = clientCodeLastModified.date
		sendBody = sendBody instanceof Date ? sendBody.toISOString() : null
		let status = sendBody ? 200 : 204 // OK : No content
		res.status(status)
			.header("Access-Control-Allow-Origin", "*")
			.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
			.send(sendBody)
	}	
}

// TODO make liveReloadServerStart use this so it doesn't need to be imported/called separately
let liveReloadFileWatcherStart = (callback)=>{
	// Watch browser client code for changes, upon which we can send a notification to the client so it can restart
	let fileWatcher = chokidar.watch([
		'browser/public/**/*.{js,json,html,css,scss,png,gif,jpg,jpeg}' // TODO this should be an arg
	],{
		ignored: /(^|[\/\\])\../, // Ignore .dotfiles
		persistent: true
	})
	
	let onBrowserFileModified = path => {
		console.info('Browser client will refresh due to change in: ' + path)
		callback(new Date())
	}

	// Don't print to console for new added files or we get a surge of them on app launch
	fileWatcher.on('add', ()=>{ callback(new Date()) })
		.on('change', onBrowserFileModified)
		.on('unlink', onBrowserFileModified)	
}

// Defining an activeLocalIP will broadcast across local network
let liveReloadServerStart = (clientCodeLastModified, hostname, portToAvoid, portToUse)=>{
	portToUse = portToUse || null 
	if (!portToAvoid){ portToUse = defaultLiveReloadPort }
	if (typeof portToAvoid === 'string'){ portToAvoid = Number(portToAvoid) }
	if (!portToAvoid){
		throw Error('Live reload: incompatible portToAvoid provided:', portToAvoid)
	}
	portToUse = portToAvoid + 1
	let e = express()
	e.get(clientCodeLastModifiedStatusRoute, makeLiveReloadMiddleware(clientCodeLastModified)) // Development-only route
	e.listen(portToUse, hostname ? hostname : '127.0.0.1', (err)=>{
		if (err) throw Error(err)
		// Server ready function
		console.info(`Live reloading server listening at: ${hostname ? hostname : '127.0.0.1'}:${portToUse}`)
	})
	e.on('error', err => {
		if (err.code === 'EADDRINUSE'){
			// Retry at the next port
			e.close()
			liveReloadServerStart(clientCodeLastModified, hostname, portToAvoid + 1, portToUse)
		}
	})
}

export { 
	clientCodeLastModifiedStatusRoute,
	portClueRoute,
	defaultLiveReloadPort,

	makeLiveReloadMiddleware,
	liveReloadFileWatcherStart,
	liveReloadServerStart
}