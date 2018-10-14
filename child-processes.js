import { config } from './config.js'

class ProcessRoster {
	constructor(){
		this.processes = {}
	}

	handleChildProcess(child, processName, resolve, reject, afterExit){
		console.debug('[ProcessRoster] Registering handlers for child process: ' + processName)
		this.processes[processName] = child

		let onStdioEvent = data => {
			if (child.pid){ // This is a pretty good indication that the child process spawned successfully
				console.info(`[ProcessRoster:${processName}] ${data.toString().trim()}`)
				resolve(data)
			} else {
				console.error(`[ProcessRoster:${processName}] This child process does not have a PID`)
				reject(data)
			}
		}
		child.stdout.on('data', onStdioEvent)
		child.stderr.on('data', onStdioEvent)

		child.on('error', (code, signal)=>{
			console.error(`[ProcessRoster:${processName}] This process hit an error with code ${code} and signal ${signal}`)
			reject({code, signal})
		})
		child.on('close', code => {
			console.info(`[ProcessRoster:${processName}] This process closed with code ${code}`)
			reject({code})
		})
		child.on('exit', code => {
			delete this.processes[processName]
			console.info(`[ProcessRoster:${processName}] This process exited with code ${code}`)
			reject({code})
			if (afterExit) afterExit(child, processName, code)
		})
	}

	ensureOneProcess(spawnFn, processName, resolve, reject){
		let startNewChild = ()=>{
			let child = spawnFn() // Must return a child_process.spawn() result
			this.handleChildProcess(child, processName, resolve, reject)
		}

		let existingProcess = this.processes[processName]
		if (existingProcess){
			existingProcess.kill('SIGINT')
			existingProcess.on('exit', (code, signal)=>{ // Does this override handleChildProcess' existing onExit handler?
				delete this.processes[processName]
				console.info(`[ProcessRoster:ensureOneProcess] Existing process "${processName}" was automatically killed & restarted`)
				startNewChild()
			})
		} else {
			startNewChild()
		}
	}

	killAll(){
		return new Promise((resolve, reject)=>{
			let checkIfAllGone = ()=>{
				if (Object.keys(this.processes).length === 0){
					resolve()
				}
			}

			for (let existingProcessKey of Object.keys(this.processes)){
				if (!this.processes.hasOwnProperty(existingProcessKey)) continue
				let existingProcess = this.processes[existingProcessKey]
				console.info(`[ProcessRoster:killAll] Killing ${existingProcessKey}...`)	
				existingProcess.kill('SIGINT')
				existingProcess.on('exit', checkIfAllGone)
			}
			checkIfAllGone()

			setTimeout(()=>{
				reject(new Error(this.processes))
			}, 1000)
		})
	}
}

export {
	ProcessRoster
}