/* global import */

// Inbuilt
let path = require('path')
let fs = require('fs')

// Run all individual tests
fs.readdir(path.join(__dirname, '.'), 'utf8', (err, files)=>{
	if (err) throw err
	let imports = []
	console.info('Running tests:' + files.join(' '))
	files.forEach(filename => {
		imports.push(import(path.join(__dirname, filename)))
	})
})