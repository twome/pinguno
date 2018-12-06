export const race = (fn, timeLimit)=>{
	let prom = new Promise((resolve, reject)=>{
		fn(resolve, reject)
		setTimeout(()=>{
			reject(Error(`[race] Provided function didn't complete before time limit.`))
		}, timeLimit)
	})

	return prom
}

export const assert = (toEvaluate, textAssertion, asyncTimeLimit)=>{
	let assessResult = (result, textAssertion)=>{
		if (!result){
			console.error('TEST FAILED: ' + textAssertion, result)
			return Error('TEST FAILED: ' + textAssertion, result)
		} else {
			console.info('TEST PASSED: ' + textAssertion)
			return {result, textAssertion}
		}
	}

	if (typeof asyncTimeLimit === 'number' && typeof toEvaluate === 'function'){
		// Asynchronous function
		return race(toEvaluate, asyncTimeLimit).then(result => {
			return assessResult(result, textAssertion)
		}, err => {
			console.error('TEST FAILED - Async assertion did not resolve promise before the time limit.')
			return assessResult(false, textAssertion)
		})
	} else {
		// Synchronous expression
		return assessResult(toEvaluate, textAssertion)
	}
}