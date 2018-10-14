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
const { config } = require('./config.js')
const { Enum } = require('./enum.js')
const { Pinguno } = require('./pinguno.js')
const { df: defaultAndValidateArgs, handleExitGracefully } = require('./my-util.js')
const { getLocalIP } = require('./my-util-network.js')
const { clientCodeLastModifiedStatusRoute, fileWatcherStart } = require('./live-reload-custom-server.js')

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
		availableOnLAN: false,
		apiPath: 'api/1',
		preferredProtocol: 'http://',
		port: 1919
	}){
		this.opt = {...options} // Bind constructor options to the instance

		// State properties
		this.activeLocalIP = getLocalIP()[0].address.trim()
		this.serverURL = new URL('http://' + this.activeLocalIP)
		this.serverURL.port = this.opt.port.toString()
		this.serverURL.protocol = this.opt.preferredProtocol
		this.latestAPIPath = this.opt.apiPath

		this.serverRunning = false			

		this.exp = express()
		let e = this.exp

		this.pinger = this.startPinger()
		this.appDir = this.pinger.appDir

		this.clientCodeLastModified = inDev ? new Date() : null

		// Allow us to parse request (could be any format) into text on req.body
		e.use(bodyParser.text())

		// Routes
		/*
			API routes
		*/
		e.get('/' + this.latestAPIPath + '/' + 'mock-session', (req, res)=>{ 
			let respond = ()=>{
				fsReadFilePromise(path.join(this.appDir, '/dev-materials/test-data_frequent-disconnects.json'), 'utf8').then((val)=>{
					res.send(val)	
				}, (err)=>{
					console.error(err)
				})
			}
			setTimeout(respond, 1)
		})
		e.get('/' + this.latestAPIPath + '/' + 'live-session', (req, res)=>{ 
			let respond = ()=>{
				let stateBefore = new Date()
				this.pinger.updateEntireState()
				if (config.NODE_VERBOSE >= 2) console.info(`State update took ${new Date() - stateBefore}ms`)
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
		
		// TEMP dev only
		e.use('/nm', express.static(path.join(this.appDir, 'browser', 'node_modules'))) // Serve node_modules/ files as if they were at /nm/

		/*
			Development-only routes
		*/
		if (inDev){
			e.get(clientCodeLastModifiedStatusRoute, (req, res, next)=>{
				let sendBody = this.clientCodeLastModified
				sendBody = sendBody instanceof Date ? sendBody.toISOString() : null
				let status = sendBody ? 200 : 204 // OK : No content
				res.status(status).send(sendBody)
			})
		}
	}

	startServer(){
		console.info('Current local (LAN) IP address: ', this.activeLocalIP)

		this.exp.listen(this.opt.port, this.opt.availableOnLAN ? this.activeLocalIP : '127.0.0.1', ()=>{
			console.info(`Pinguno server listening at: ${this.opt.availableOnLAN ? this.activeLocalIP : '127.0.0.1'}:${this.opt.port}`)
			this.serverRunning = true
		})
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

	cleanExit(){
		return this.pinger.cleanExit().then(()=>{
			process.exit()
		})
	}
}

let app = new Server()
app.startServer()

// TEMP DEV only
if (inDev){ 
	fileWatcherStart(date => app.clientCodeLastModified = date)
}

handleExitGracefully(undefined, ()=>{
	app.cleanExit()
})

exports = { Server, clientModes }