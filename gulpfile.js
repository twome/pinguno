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
const gConcat = require('gulp-concat')
const gUglify = require('gulp-uglify')
const gRename = require('gulp-rename')
const gESLint = require('gulp-eslint')
const gDebug = require('gulp-debug')
const gWebpack = require('webpack-stream')
const gNamed = require('vinyl-named')

// In-house
const {
	ensureOneProcess,
	handleChildProcess,
	existingChildProcesses
} = require('./child-processes.esm.js')

// Convenience assignmenmts
let inDev = process.env.NODE_ENV === 'development'
let p = path.join
let paths = {
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

let lintBackendProdTask = () => gulp.src([
	'./*.js',
	'!browser/**/*',
	'!ignored/**/*'
])
	.pipe(gESLint({
		rules: {
			"no-console": 0,
			// "no-unused-vars": 0,
			// "no-useless-escape": 0
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
	}))
	.pipe(gESLint.format())
	.pipe(gESLint.failAfterError())

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

let sassTask = () => gulp.src(p(paths.scss.src, '**/*.scss'))
	.pipe(gSourcemaps.init())
	.pipe(gSass({
		// outputStyle: 'compressed'
	}).on('error', gSass.logError))
	.pipe(gSourcemaps.write('./sourcemaps')) // Path relative to dest() path
	.pipe(gulp.dest(paths.scss.dest))

let webpackTask = () => gulp.src(p(paths.js.src, 'entry.js'))
	.pipe(gNamed())
	.pipe(gWebpack({
		entry: {
			'live-reload-custom': p(paths.js.src, 'live-reload-custom.esm.js'),
			'main': p(paths.js.src, 'entry.js')
		},
		output: {
			filename: '[name].bundle.js'
		},
		devtool: inDev ? false : 'source-map',
		// devtool: false,
		optimization: {
			minimize: inDev ? false : undefined // Defaults to minimising
		},
		mode: inDev ? 'development' : 'production'
	})).on('error', (err)=>{
      console.error('[gWebpack stream error]...')
      console.error(err)
    }) // Returns the same stream
	.pipe(gulp.dest(paths.js.dest))

let serverTask = () => new Promise ((resolve, reject)=>{
	ensureOneProcess(()=>{
		return child_process.spawn('node', ['server'])
	}, 'server', resolve, reject)
})

let pkgTask = () => new Promise((resolve, reject)=>{
	// DANGER: Variable value fed to command line
	let buildPath = path.normalize(paths.pkg.prod) // Just another check to try ensure this is indeed a path
	let child = child_process.spawn(`pkg`, [`.`, `--out-path`, buildPath, `--debug`])
	handleChildProcess(child, 'pkg', resolve, reject)
})

let sassWatch = ()=>{
	return gulp.watch(
		p(paths.scss.src, '**/*.scss'), 
		sassTask
	)
}

let jsWatch = ()=>{
	let watcher = gulp.watch(
		p(paths.js.src, '**/*.js'),
		(callback)=>{
			return new Promise((resolve, reject)=>{
				// webpackTask is a fn that returns a stream
				webpackTask().on('data', (val)=>{
					resolve(val)
				}).on('error', (err)=>{
					console.error('jsWatch webpack task wrapper error: ', err)
					reject(err)
				})
			})
		}
	)

	// Chokidar error events
	watcher.on('error', (...params)=>{
		params.forEach((val, key)=>{
			console.debug(`jsWatch chokidar error event - ${key}:`, val)
		})
	})

	return watcher
}


let serverWatch = () => gulp.watch([
	p(__dirname, `/*.js`)
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
		p(paths.wholeBrowserClient.src, '**')
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

let buildTask = gulp.series(
	cleanTask,
	lintBackendProdTask, 
	lintBrowserTask,
	sassTask,
	webpackTask,
	pkgTask, 
	exportBrowserToDistTask
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

// Watchers
module.exports['watch:sass'] = sassWatch
module.exports['watch:js'] = jsWatch

// One-command workflows
module.exports['dev'] = devTask
module.exports['build'] = buildTask

// Run 'dev' if we call `gulp` in the CLI with no arguments.
module.exports['default'] = devTask

/*
	Dependency tasks run async & simultaneous by default.
	Note: Are your tasks running before the dependencies are complete?
	Make sure your dependency tasks are correctly using the async run hints: take in a callback or return a promise or event stream.
*/