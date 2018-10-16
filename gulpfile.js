// Inbuilt
const path = require('path')
const util = require('util')
const child_process = require('child_process')

// 3rd-party
require = require('esm')(module) /* eslint-disable-line no-global-assign */
const del = require('del')

// Gulp & plugins
const gulp = require('gulp')
const gSass = require('gulp-sass')
const gSourcemaps = require('gulp-sourcemaps')
const gConcat = require('gulp-concat')
const gUglify = require('gulp-uglify')
const gRename = require('gulp-rename')
const gESLint = require('gulp-eslint')
const gDebug = require('gulp-debug')
const gWebpack = require('webpack-stream')
const gNamed = require('vinyl-named')
const gRestart = require('gulp-restart')
const gTemplate = require('gulp-template')

// In-house
const { config } = require('./config.js')
const { ProcessRoster } = require('./child-processes.js')

let processRoster = new ProcessRoster()

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
	p(__dirname, `child-processes.js`),
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

let serverTask = () => new Promise ((resolve, reject)=>{
	// TEMP disabled for testing
	let nodeCLArgs = [
		'server-esm-adapter',
		'--experimental-vm-modules'
	]
	if (inDev) nodeCLArgs.push('--inspect-brk=127.0.0.1:1919')
	
	processRoster.ensureOneProcess(()=>{		
		return child_process.spawn('node', nodeCLArgs)
	}, 'server', resolve, reject)

	resolve()
})

// Prod only
let pkgTask = () => new Promise((resolve, reject)=>{
	// DANGER: Variable value fed to command line
	let buildPath = path.normalize(paths.pkg.prod) // Just another check to try ensure this is indeed a path
	if (!buildPath){ throw Error('[gulp:pkg] Invalid build path: ' + buildPath)}
	let child = child_process.spawn(`pkg`, [`.`, `--out-path`, buildPath, `--debug`])
	processRoster.handleChildProcess(child, 'pkg', resolve, reject)
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

let devTask = gulp.series(
	gulp.parallel(
		sassTask,
		webpackTask,
		serverTask
	),
	gulp.parallel(
		sassWatch,
		jsWatch,
		serverWatch
	)
)

let browserProdTask = gulp.series(
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
	cleanTask,
	gulp.parallel(
		lintBackendProdTask, 
		lintBrowserTask
	),
	sassTask,
	webpackTask,
	exportBrowserToDistTask,
	htmlTask,
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
	console.error(`[gulp] One of the configuration files Gulp depends on has changed, ending gulp.`)
	return processRoster.killAll().then(()=>{
		console.info('Self-killing gulp process...')
		process.exit()
	},(err)=>{
		throw Error(err)
	})
})

process.on('SIGINT', ()=>{
	console.info('[gulp] Received SIGINT; program is now exiting')

	let ensureExit = ()=>{
		setTimeout(()=>{
			process.exit() // Don't wait longer than a second before exiting, despite app's memory/storage/request state.
		}, 1000)
	}

	ProcessRoster.killAll().then(()=>{
		process.exit()
	})
	ensureExit()
})