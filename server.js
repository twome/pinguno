// Built-in modules
const fs = require('fs')
const util = require('util')
const os = require('os')
const path = require('path')

// 3rd-party dependencies
const express = require('express')
const axios = require('axios')
const opn = require('opn')
const { DateTime } = require('luxon')
const bodyParser = require('body-parser')
const chokidar = require('chokidar')

// In-house modules
import { config } from './config.js'
import { Enum } from './my-util-iso.js'
import { Pinguno } from './pinguno.js'
import { getLocalIP } from './my-util-network.js'
import { 
	clientCodeLastModifiedStatusRoute,
	liveReloadFileWatcherStart,
	makeLiveReloadMiddleware,
	liveReloadServerStart
} from './live-reload-custom-server.js'

const fsReadFilePromise = util.promisify(fs.readFile)

// Convenience / shorthands
let inDev = process.env.NODE_ENV === 'development'

// Whether we expect our client content to be used by 
// NB. ideally, this shouldn't matter at all.
let clientModes = new Enum(['browser', 'electron'])

class Server {
	// Accept one argument (an options object) and destructure specified properties (which we name in the default parameter) from that argument into the properties
	// Any argument properties that don't use the name we expect are ignored, and any undefined expected properties are defaulted
	constructor({...options} = {
		clientModes: clientModes,
		clientMode: clientModes.browser,
		makeAvailableOnLAN: false,
		apiPath: 'api/1',
		preferredProtocol: 'http://',
		port: 1919,
		serverStartRetryIntervalMs: 5000
	}){
		this.opt = {...options} // Bind constructor options to the instance

		// State properties
		this.activeLocalIP = null
		this._localhostIP = '127.0.0.1'
		this.serverURL = null
		this.updateLocalIPAddress()
		this.updateLocalIPAddressTick = setInterval(()=>{
			this.updateLocalIPAddress
		}, 5000)

		this.latestAPIPath = this.opt.apiPath
		this.chosenServerHostname = (this.opt.makeAvailableOnLAN && this.activeLocalIP) ? this.activeLocalIP : this._localhostIP
	
		this.retryStartTick = null	

		this.exp = express()
		let e = this.exp
		this.activeHTTPServer = null

		this.pinger = this.startPinger()
		this.appDir = this.pinger.appDir

		this.clientCodeLastModified = inDev ? { date: new Date() } : null

		// Allow us to parse request (could be any format) into text on req.body
		e.use(bodyParser.text())

		// Routes
		/*
			API routes
		*/
		e.get('/' + this.latestAPIPath + '/' + 'live-session', (req, res)=>{ 
			let respond = ()=>{
				let stateBefore = new Date()
				this.pinger.updateEntireState()
				if (config.NODE_VERBOSE >= 3) console.info(`State update took ${new Date() - stateBefore}ms`)
				res.send(JSON.stringify(this.pinger))	
			}
			setTimeout(respond, 1)
		})
		e.get('/' + this.latestAPIPath + '/' + 'actions' + '/' + 'open-current-log-json', (req, res)=>{ 
			if (this.pinger.activeLogURI){
				opn(this.pinger.activeLogURI).then((val)=>{
					res.send(val)
				})	
			}
		})

		/*
			Static data routes
		*/
		e.use('/', express.static(path.join(this.appDir, 'browser', 'public'))) // Serve brower/public/ files as if they were at domain root
	

		/*
			Development-only routes
		*/
		// Add custom live reload middleware
		if (inDev){
			e.get(clientCodeLastModifiedStatusRoute, makeLiveReloadMiddleware(this.clientCodeLastModified))
		}
	}

	updateLocalIPAddress(){
		try {
			this.activeLocalIP = getLocalIP()[0].address.trim()
			this.serverURL = new URL('http://' + this.activeLocalIP)
			this.serverURL.port = this.opt.port.toString()
			this.serverURL.protocol = this.opt.preferredProtocol
		} catch (error){
			this.activeLocalIP = null
			this.serverURL = null
			console.error(`[server] Can't find a local IP address - are your network adapters (WiFi, ethernet etc) on?`)
		}
		return {
			activeLocalIP: this.activeLocalIP,
			serverURL: this.serverURL
		}
	}

	startServer(){

		if (this.opt.makeAvailableOnLAN){
			if (this.activeLocalIP){
				console.info('Current local (LAN) IP address: ', this.activeLocalIP)	
				if (this.retryStartTick) clearInterval(this.retryStartTick)
			} else {
				console.error(`[server:startServer] Can't find a local IP address - no network to serve web UI on.`)
				if (!this.retryStartTick) this.retryStartTick = setInterval(()=>{
					this.startServer()
				}, this.opt.serverStartRetryIntervalMs || 5000)
				return false
			}
		}

		this.activeHTTPServer = this.exp.listen(this.opt.port, this.chosenServerHostname, err => {
			// This handler is effectively a .('listen') handler on the .listen() returned active server
			if (err){
				throw Error('[server:listen] Error starting server listener:', err)
			}
			
			console.info(`Pinguno server listening at: ${this.chosenServerHostname}:${this.opt.port}`)
		})

		this.activeHTTPServer.on('error', err => {
			if (err.code === 'EADDRINUSE'){
				let retryIntervalMs = 5000
				console.info(`[server:registerServerErrorHandlers] IP address / port already in use, retrying in ${retryIntervalMs}...`)
				this.completelyRestart(retryIntervalMs)
			} else {
				throw Error(`Error with unhandled code "${err.code}":`, err)
			}
		})

		return this.activeHTTPServer
	}

	startUp(){
		this.pinger = this.startPinger()
		this.startServer()
	}

	shutDown(){
		this.pinger.shutDown()
		this.activeHTTPServer.close()
	}

	completelyRestart(retryIntervalMs){
		console.info('[server] Completely restarting Express server & pingers')
		this.shutDown()
		setTimeout(()=>{
			this.startUp()
		}, retryIntervalMs || 5000)
	}

	startPinger(){
		let pinger = new Pinguno()
		pinger.startPinging(pinger.pingTargets)

		let connectionStatusTick = setInterval(()=>{
			pinger.updateGlobalConnectionStatus()
			let stdoutConnectionMessage = DateTime.local().toFormat('yyyy-LL-dd HH:mm:ss.SSS') + ' Internet connected?: ' + pinger.updateGlobalConnectionStatus().humanName
			if (config.NODE_VERBOSE >= 2) console.info(stdoutConnectionMessage)
		}, pinger.opt.connectionStatusIntervalMs)

		let updateOutagesTick = setInterval(()=>{	
			pinger.updateOutages()
		}, pinger.opt.updateOutagesIntervalMs)

		let updateSessionEndTimeTick = setInterval(()=>{
			pinger.updateSessionEndTime()
		}, pinger.opt.updateSessionEndTimeIntervalMs)

		let statsTick = setInterval(()=>{
			pinger.updateSessionStats()
		}, pinger.opt.updateSessionStatsIntervalMs)

		this.pingerRunning = true
		return pinger
	}
}

let app = new Server()
app.startServer()

if (inDev){
	liveReloadFileWatcherStart((date)=>{
		app.clientCodeLastModified.date = date
	})
	liveReloadServerStart(app.clientCodeLastModified, app.chosenServerHostname, app.opt.port)
}

exports = { Server, clientModes }