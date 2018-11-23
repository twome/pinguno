// Inbuilt
const path = require('path')
const util = require('util')
const child_process = require('child_process')

// 3rd-party
const del = require('del')

// Gulp & plugins
const gulp = require('gulp')
const gSass = require('gulp-sass')
const gSourcemaps = require('gulp-sourcemaps')
const gESLint = require('gulp-eslint')
const gDebug = require('gulp-debug')
const gWebpack = require('webpack-stream')
const gNamed = require('vinyl-named')
const gTemplate = require('gulp-template')

// In-house
const { config } = require('./config.js')

// Convenience assignmenmts
let inDev = process.env.NODE_ENV === 'development'

let p = path.join
let paths = {
	html: {
		src: p(__dirname, 'browser/public'),
		dest: p(__dirname, 'browser/dist')
	},
	scss: {
		src: p(__dirname, 'browser/scss'),
		dest: p(__dirname, 'browser/public/styles')
	},
	js: {
		src: p(__dirname, 'browser/js'),
		dest: p(__dirname, 'browser/public/scripts')
	},
	pkg: {
		prod: p(__dirname, 'build')
	},
	wholeBrowserClient: {
		src: p(__dirname, 'browser/public'),
		dest: p(__dirname, 'browser/dist')
	}
}

let gulpConfigDependencies = [
	p(__dirname, `gulpfile.js`),
	p(__dirname, 'config.js'),
	p(__dirname, '.env'),
	p(__dirname, 'package.json')
]

let ignorePaths = pathArr => pathArr.map(val => '!' + val)

let lintBackendProdTask = ()=>{
	let esLintConfig = {
		rules: {
			'no-console': 0
		},
		globals: [
			'jQuery',
			'$'
		],
		envs: [
			'node',
			'es6'
		],
		extends: 'eslint:recommended',
		parserOptions: {
			sourceType: 'module',
			ecmaVersion: 2018
		}
	}
	if (inDev){ 
		esLintConfig.rules['no-unused-vars'] = 0
	}
	return gulp.src([
		'./*.js',
		'!browser/**/*',
		'!ignored/**/*'
	])
		.pipe(gESLint(esLintConfig))
		.pipe(gESLint.format())
		.pipe(gESLint.failAfterError())
}

let lintBrowserTask = () => gulp.src(p(paths.js.src, '**/*.js'))
	.pipe(gESLint({
		env: {
			es6: true,
			browser: true
		},
		parserOptions: {
			sourceType: 'module',
			ecmaVersion: 2018
		},
		extends: 'eslint:recommended',
		rules: {
			'no-unused-vars': 0,
			'no-console': 0
		},
		globals: []
	}))
	.pipe(gESLint.format())
	.pipe(gESLint.failAfterError())

let sassTask = () => {
	let stream = gulp.src(p(paths.scss.src, '**/*.scss'))
	if (config.CSS_SOURCEMAPS) stream = stream.pipe(gSourcemaps.init())
	stream = stream.pipe(gSass({
		outputStyle: inDev ? 'nested' : 'compressed',
		sourceComments: inDev ? true : false
	}).on('error', gSass.logError))
	if (config.CSS_SOURCEMAPS) stream = stream.pipe(gSourcemaps.write('./sourcemaps')) // Path relative to dest() path
	return stream.pipe(gulp.dest(paths.scss.dest))
}

let webpackTask = ()=>{
	let webpackConfig = {
		entry: {
			'main': p(paths.js.src, 'entry.js')
		},
		output: {
			filename: '[name].bundle.js'
		},
		devtool: 'source-map',
		optimization: {
			minimize: undefined // Defaults to minimising
		},
		mode: 'production'
	}
	if (inDev){
		webpackConfig.entry['live-reload-custom'] = p(paths.js.src, 'live-reload-custom.js')
		webpackConfig.devtool = false
		webpackConfig.optimization.minimize = false
		webpackConfig.mode = 'development'
	}

	// Not sure what specifying entry.js does here vs in webpack's `entry` config
	let stream = gulp.src(p(paths.js.src, 'entry.js')) 
		.pipe(gNamed())
		.pipe(gWebpack(webpackConfig))
		.on('error', (err)=>{
			console.error('[gWebpack stream error]...')
			console.error(err)
		}) // Returns the same stream
		.pipe(gulp.dest(paths.js.dest))
	return stream
}

let moveJsTask = ()=>{
	gulp.src([
		p(paths.js.src, 'entry.js'),
		p(paths.js.src, 'live-reload-custom.js')
	]).pipe(gulp.dest(paths.js.dest))
}

let serverProcess = null
let serverTaskProm = (resolve, reject)=>{
	let nodeCLArgs = [
		'server-esm-adapter',
		'--experimental-vm-modules'
	]
	if (inDev) nodeCLArgs.push('--inspect=127.0.0.1:1919')
		
	serverProcess = child_process.spawn('node', nodeCLArgs)

	let logOutput = (data)=>{
		if (config.NODE_VERBOSE >= 2) console.info(`[gulp:server] ${data.toString().trim()}`)
		resolve(serverProcess)
	}
	serverProcess.stdout.on('data', logOutput)
	serverProcess.stderr.on('data', logOutput) // An express.listen() EADDRINUSE error will output here

	serverProcess.on('error', (err)=>{
		console.error('[gulp:server] Error while starting server...')
		console.error(err)
		serverProcess.kill(serverProcess.pid, 'SIGTERM')
		reject(err)
	})
}
let serverTask = ()=>{
	return new Promise(serverTaskProm)
}

// Prod only
let pkgTask = () => new Promise((resolve, reject)=>{
	// DANGER: Variable value fed to command line
	let buildPath = path.normalize(paths.pkg.prod) // Just another check to try ensure this is indeed a path
	if (!buildPath){ throw Error('[gulp:pkg] Invalid build path: ' + buildPath)}
	let childProcess = child_process.spawn(`pkg`, [`.`, `--out-path`, buildPath, `--debug`])
})

// Prod only
let htmlTask = () => {
	return gulp.src(p(paths.html.src, 'index.html'))
		.pipe(gTemplate({
			inDev: inDev,
			env: process.env.NODE_ENV,
			pingunoDOMPrefix: 'pn-'
		}))
		.pipe(gulp.dest(paths.html.dest))
}

let sassWatch = ()=>{
	return gulp.watch(
		p(paths.scss.src, '**/*.scss'), 
		sassTask
	)
}

let jsWatch = ()=>{
	return gulp.watch(
		p(paths.js.src, '**/*.js'),
		webpackTask
	)
}

let serverWatch = () => gulp.watch([
	p(__dirname, `/*.js`),
	...ignorePaths(gulpConfigDependencies)
], serverTask)

// CAUTION: This deletes the containing folders, not just the contents.
// Our build process should be able to handle recreating missing folders smoothly.
let cleanTask = callback => {
	return del([
		paths.scss.dest,
		paths.js.dest,
		paths.pkg.prod,
		paths.wholeBrowserClient.dest
	])
}

let exportBrowserToDistTask = () => {
	return gulp.src([
		p(paths.wholeBrowserClient.src, '**'),
		'!' + p(paths.wholeBrowserClient.src, 'index.html')
	])
		.pipe(gDebug())
		.pipe(gulp.dest(
			p(paths.wholeBrowserClient.dest, '/')
		))
}

// TODO unfinished
let testTask = ()=>{
	let stream = gulp.src([
		p(paths.test, '**')
	])
}

let devTask = gulp.series(
	gulp.parallel(
		sassTask,
		webpackTask,
		// moveJsTask, // Skip over webpack and just move the untouched JS files over
		serverTask
	),
	gulp.parallel(
		sassWatch,
		jsWatch,
		serverWatch
	)
)

let browserProdTask = gulp.series(
	testTask,
	cleanTask,
	gulp.parallel(
		lintBackendProdTask, 
		lintBrowserTask
	),
	sassTask,
	webpackTask,
	exportBrowserToDistTask,
	htmlTask
)

let buildExesTask = gulp.series(
	browserProdTask,
	pkgTask
)

// Export atomised tasks in case we want to run them for specialised reasons
module.exports['sass'] = sassTask
module.exports['pkg'] = pkgTask 
module.exports['lintbackend:prod'] = lintBackendProdTask 
module.exports['lintbrowser'] = lintBrowserTask 
module.exports['webpack'] = webpackTask 
module.exports['server'] = serverTask 
module.exports['clean'] = cleanTask 
module.exports['export:browser'] = exportBrowserToDistTask 
module.exports['html'] = htmlTask 
module.exports['test'] = testTask

// Watchers
module.exports['watch:sass'] = sassWatch
module.exports['watch:js'] = jsWatch

// One-command workflows
module.exports['dev'] = devTask
module.exports['browser:prod'] = browserProdTask
module.exports['build'] = buildExesTask

// Run 'dev' if we call `gulp` in the CLI with no arguments.
module.exports['default'] = devTask
 
// Automatically end gulp if any of its dependencies change
gulp.watch(gulpConfigDependencies, ()=>{
	console.error(`[gulpfile] One of the configuration files Gulp depends on has changed, ending gulp.`)
	process.kill(serverProcess.pid, 'SIGINT')
	process.kill(process.pid, 'SIGINT')
})

// Instead of running 'gulp <command>' as a CLI, simply run this file with node.
if (module === process.mainModule){ // We are running this gulpfile.js directly with node
	console.info(`Executing gulpfile using node (instead of Gulp's CLI).`)

	if (process.argv.length >= 4){ 
		throw Error('[gulpfile] Too many command-line arguments provided to gulpfile - we expect just one; the name of the gulp task to execute.') 
	}
	let taskName = process.argv[2]
	if (taskName){
		console.info(`Attempting to execute Gulp task "${taskName}"`)
		// Because we've exported tasks to the module rather than using gulp.task to register them,
		// we can just call them directly from inside this same module.
		let result = module.exports[taskName]()
		if (result instanceof Promise){
			result.then((val)=>{
				console.info(`[gulp:${taskName}] Task resolved.`)
			},(err)=>{
				throw Error(err)
			})
		}
	} else {
		console.info(`No Gulp task argument provided, executing default task.`)
		module.exports.default()
	}
}