// Built-in
const fs = require('fs')
const util = require('util')
const path = require('path')

const fsWriteFilePromise = util.promisify(fs.writeFile)

// In-house
const { Pinguno } = require('./pinguno.js')

// Run in the original module only after the main class has been defined
let attachExtensions = (Pinguno)=>{
	// Save this session's active settings/config to a git-ignored log for replicable results
	// NB. will overwrite existing file at this path
	// TODO: Promisify this
	Pinguno.prototype.saveSessionConfigToJSON = function(callback){
		let settings = this.opt
		let fileUri = settings.configLastUsedPath
		let dirPath = path.dirname(fileUri)
		let content = JSON.stringify(settings, null, settings.pingLogIndent)

		let onMakeDirectory = (err)=>{
			if (err){
				console.debug(`Failed to make directory ${dirPath} error:`, err)
			}
			let prom = fsWriteFilePromise(fileUri, content, 'utf8').then((file)=>{
				return fileUri
			}, (error)=>{
				console.error('Error encountered when saving this session\'s settings:', error)
				return error
			})
			callback(prom)
		}

		fs.mkdir(dirPath, undefined, onMakeDirectory)
	}
}

exports.attachExtensions = attachExtensions