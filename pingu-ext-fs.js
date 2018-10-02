// Built-in
const fs = require('fs')
const util = require('util')

const fsWriteFilePromise = util.promisify(fs.writeFile)

// In-house
const { Pingu } = require('./pingu.js')

let attachExtensions = (ClassObj)=>{
	// Save this session's active settings/config to a git-ignored log for replicable results
	// NB. will overwrite existing file at this path
	ClassObj.prototype.saveSessionConfigToJSON = function(){
		let settings = this.opt
		let fileUri = settings.configLastUsedPath
		let content = JSON.stringify(settings, null, settings.pingLogIndent)
		return fsWriteFilePromise(fileUri, content, 'utf8').then((file)=>{
			return fileUri
		}, (error)=>{
			console.error(error)
			return error
		})
	}
}

exports.attachExtensions = attachExtensions