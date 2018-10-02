// Built-in modules
const fs = require('fs')
const util = require('util')
const os = require('os')

// 3rd-party dependencies
const express = require('express')
const axios = require('axios')
const { DateTime } = require('luxon')

// In-house modules
const { config } = require('./config.js')
const { Enum } = require('./enum.js')
const { Pingu } = require('./pingu.js')

const fsReadFilePromise = util.promisify(fs.readFile)

// Whether we expect our client content to be used by 
// NB. ideally, this shouldn't matter at all.
let clientModes = new Enum(['browser', 'electron'])

class Server {
	// Accept one argument (an options object) and destructure specified properties (which we name in the default parameter) from that argument into the properties
	// Any argument properties that don't use the name we expect are ignored, and any undefiend expected properties are defaulted
	constructor({...options} = {
		clientModes: clientModes,
		clientMode: clientModes.browser,
		availableOnLAN: false,
		port: 6969
	}){
		this.opt = {...options} // Bind constructor options to the instance

		// State properties
		this.serverRunning = false
		this.pingerRunning = false

		this.exp = express()
		let e = this.exp

		this.pinger = this.startPinger()

		// Routes
		e.get('/mock-session', (req, res)=>{ 
			console.debug('GET request received')

			let respond = ()=>{

				fsReadFilePromise('../dev-materials/test-data_frequent-disconnects.json', 'utf8').then((val)=>{
					// console.debug(val)
					// res.send(val)	
					res.send('Hello Wurld!')	
				}, (err)=>{
					console.error('file read error:')
					console.error(err)
				})
				
			}

			setTimeout(respond, 1)
		})

		e.get('/', (req, res)=>{ 
			console.debug('GET request received')

			// this.startPinger()

			let respond = ()=>{
				res.send(JSON.stringify(this.pinger.sessionStats))	
			}

			setTimeout(respond, 1)
		})

		e.post('/', function (req, res) {
			console.debug('request received')
			res.send('Got a POST request')
		})
	}

	// Credit https://stackoverflow.com/a/8440736/1129420
	getLocalIp(){
		let interfaces = os.networkInterfaces()

		Object.keys(interfaces).forEach((ifname)=>{
			let alias = 0

			interfaces[ifname].forEach((interface)=>{
				if ('IPv4' !== interface.family || interface.internal !== false) {
		    	// Skip over internal (i.e. 127.0.0.1) and non-IPV4 addresses
		    	return
		    }

		    if (alias >= 1) {
		      	// This single interface has multiple IPV4 addresses
		      	console.log(ifname + ':' + alias, interface.address);
		    } else {
		      	// This interface has only one IPV4 adress
		      	console.log(ifname, interface.address);
		    }

		    ++alias
		  })
		})
	}

	start(){
		this.exp.listen(this.opt.port, ()=>{
			console.info(`Listening on port ${this.opt.port}`)
		})
		this.serverRunning = true
	}

	startPinger(){
		let pinger = new Pingu()
		pinger.startPinging(pinger.pingTargets)

		let connectionStatusTick = setInterval(()=>{
			pinger.updateInternetConnectionStatus()
			console.log(DateTime.local().toFormat('yyyy-LL-dd HH:mm:ss.SSS') + ' Internet connected?: ' + pinger.updateInternetConnectionStatus().humanName)
		}, pinger.opt.connectionStatusIntervalMs)

		let updateOutagesTick = setInterval(()=>{	
			pinger.updateOutages()
		}, pinger.opt.updateOutagesIntervalMs)

		let updateSessionEndTimeTick = setInterval(()=>{
			pinger.updateSessionEndTime()
		}, pinger.opt.updateSessionEndTimeIntervalMs)

		let statsTick = setInterval(()=>{
			pinger.updateSessionStats()
			console.info(pinger.sessionStats)
		}, pinger.opt.updateSessionStatsIntervalMs)

		console.debug('started pinger')
		return pinger
	}

	// getGithubUser(username){
	//     return axios.get(`https://api.github.com/users/${username}`).then(res => res.data, err => console.error(err))
	// }	
}

let app = new Server()
app.start()

// app.getGithubUser('twome').then((val)=>{
	// console.debug(val)
// }) 

exports.Server = Server