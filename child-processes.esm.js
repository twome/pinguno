let existingChildProcesses = {}
let handleChildProcess = (child, processName, resolve, reject) => {
	existingChildProcesses[processName] = child

	let onStdioEvent = data => {
		if (child.pid){ // This is a pretty good indication that the child process spawned successfully
			console.info(`[gulp:${processName}] ${data.toString().trim()}`)
			resolve(data)
		} else {
			console.error(`gulp.${processName} child process does not have a PID`)
			reject(data)
		}
	}
	child.stdout.on('data', onStdioEvent)
	child.stderr.on('data', onStdioEvent)

	child.on('error', (code, signal)=>{
		console.error(`gulp.${processName} process hit an error with code ${code} and signal ${signal}`)
		reject({code, signal})
	})
	child.on('close', code =>{
		console.info(`gulp.${processName} process closed with code ${code}`)
		reject({code})
	})
	child.on('exit', code =>{
		console.info(`gulp.${processName} process exited with code ${code}`)
		reject({code})
	})
}
let ensureOneProcess = (spawnFn, processName, resolve, reject)=>{
	let startNewChild = ()=>{
		let child = spawnFn() // Must return a child_process.spawn() result
		handleChildProcess(child, processName, resolve, reject)
	}

	let existingProcess = existingChildProcesses[processName]
	if (existingProcess){
		existingProcess.kill('SIGINT')
		existingProcess.on('exit', (code, signal)=>{ // Does this override handleChildProcess' existing onExit handler?
			console.info(`[gulp:ensureOneProcess] Existing process "${processName}" was automatically killed & restarted`)
			startNewChild()
		})
	} else {
		startNewChild()
	}
}

module.exports = {
	ensureOneProcess,
	handleChildProcess,
	existingChildProcesses
}