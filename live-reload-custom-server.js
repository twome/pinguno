// side-effects: true
// DEVELOPMENT ONLY

// This is used for live-reloading (informing client that the code powering the client is obsolete, so refresh the URL to 
// update the client app).

const chokidar = require('chokidar')
const express = require('express')

let clientCodeLastModifiedStatusRoute = '/dev/client-code-last-modified'
let portClueRoute = '/dev/live-reload-port-clue'
let defaultLiveReloadPort = '1919'
let clientCodeLastModified = new Date()

let liveReloadMiddleware = (req, res, next)=>{
	let sendBody = clientCodeLastModified
	sendBody = sendBody instanceof Date ? sendBody.toISOString() : null
	let status = sendBody ? 200 : 204 // OK : No content
	res.status(status).send(sendBody)
}	

let fileWatcherStart = (callback)=>{
	let internalLastModified = new Date

	// Watch browser client code for changes, upon which we can send a notification to the client so it can restart
	let fileWatcher = chokidar.watch([
		'browser/public/**/*.{js,json,html,css,scss,png,gif,jpg,jpeg}'
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
let liveReloadServerStart = (port, activeLocalIP)=>{
	if (!port){ port = defaultLiveReloadPort }
	if (typeof port === 'string'){ port = Number(port) }
	if (!port){
		throw Error('Live reload: incompatible port provided:', port)
	}
	let e = express()
	e.get(clientCodeLastModifiedStatusRoute, liveReloadMiddleware) // Development-only route
	e.listen(port, activeLocalIP ? activeLocalIP : '127.0.0.1', (err)=>{
		if (err) throw Error(err)
		// Server ready function
		console.info(`Live reloading server listening at: ${activeLocalIP ? activeLocalIP : '127.0.0.1'}:${port}`)
	})
}

module.exports = { 
	clientCodeLastModifiedStatusRoute,
	portClueRoute,
	defaultLiveReloadPort,

	fileWatcherStart,
	liveReloadServerStart
}