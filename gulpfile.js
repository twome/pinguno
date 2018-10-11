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
const gWebpack = require('webpack-stream')
const webpackStreamCompiler = require('webpack')

// Convenience assignmenmts
let inDev = process.env.NODE_ENV === 'development'
let p = path.join
let paths = {
	scss: {
		src: path.resolve(__dirname, 'browser/scss'),
		dest: path.resolve(__dirname, 'browser/public/styles')
	},
	js: {
		src: path.resolve(__dirname, 'browser/js'),
		dest: path.resolve(__dirname, 'browser/public/scripts')
	},
	pkg: {
		prod: path.resolve(__dirname, 'build')
	}
}

let lintBackendProdTask = ()=>{
	return gulp.src([
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
}

let lintBrowserTask = ()=>{
	return gulp.src(p(paths.js.src, '**/*.js'))
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
}

let sassTask = ()=>{
	return gulp.src(p(paths.scss.src, '**/*.scss'))
		.pipe(gSourcemaps.init())
		.pipe(gSass({
			// outputStyle: 'compressed'
		}).on('error', gSass.logError))
		.pipe(gSourcemaps.write('./sourcemaps')) // Path relative to dest() path
		.pipe(gulp.dest(paths.scss.dest))
}

let webpackTask = ()=>{
	return gulp.src(p(paths.js.src, 'entry.js'))
		.pipe(gWebpack({
			entry: {
				'live-reload-custom': p(paths.js.src, 'live-reload-custom.esm.js'),
				'main': p(paths.js.src, 'entry.js')
			},
			output: {
				filename: '[name].bundle.js'
			},
			devtool: inDev ? undefined : 'source-map',
			mode: inDev ? 'development' : 'production'
		}, webpackStreamCompiler))
		.pipe(gulp.dest(paths.js.dest))
}

let serverTask = () => new Promise ((resolve, reject)=>{
	let child = child_process.spawn('node', ['server.js'], {
		env: { 
			NODE_ENV: 'development'
		},
		cwd: __dirname
	})
	let onStdioEvent = (data) => {
		if (child.pid){ // This is a pretty good indication that the child process spawned successfully
			console.info(`gulp:server spawned with pid ${child.pid}`)
			resolve(data)
		} else {
			reject(data)
		}
	}
	child.stdout.on('data', onStdioEvent)
	child.stderr.on('data', onStdioEvent)
	child.on('error', (code, signal)=>{
		console.error('gulp:server process hit an error with ' + `code ${code} and signal ${signal}`)
		reject({code, signal})
	})
	child.on('close', (code)=>{
		console.info(`gulp:server process closed with code ${code}`)
		reject({code})
	})
	child.on('exit', (code)=>{
		console.info(`gulp:server process exited with code ${code}`)
		reject({code})
	})
})

let pkgTask = ()=>{
	return new Promise((resolve, reject)=>{
		let iCUDir = p(__dirname, 'node_modules/full-icu')
		const child = child_process.exec(`pkg . --out-path ${path.pkg.prod} --debug`, {
			env: {
				NODE_ICU_DATA: iCUDir
			}
		}, (err, stdout, stderr)=>{
			if (err){ reject(err) }
			if (stdout){ resolve(stdout) }
			if (stderr){ reject(stderr) }
		})
	})
}

let sassWatch = ()=>{
	return gulp.watch(
		p(paths.scss.dest, '**/*.scss'), 
		sassTask
	)
}

let jsWatch = ()=>{
	return gulp.watch(
		p(paths.js.src, '**/*.js'), 
		gulp.parallel(
			webpackTask
		) 
	)
}

let cleanTask = (callback)=>{
	del([
		paths.scss.dest,
		paths.js.dest,
		paths.pkg.prod
	], callback)
}

let devTask = gulp.parallel(
	serverTask,
	gulp.series(
		gulp.parallel(
			sassTask,
			webpackTask
		), 
		sassWatch,
		jsWatch
	)
)
module.exports['dev'] = devTask

let buildTask = gulp.series(
	// cleanTask,
	pkgTask, 
	lintBackendProdTask, 
	lintBrowserTask
)
module.exports['build'] = buildTask

// Run 'dev' if we call `gulp` in the CLI with no arguments.
gulp.task('default', devTask)

// Export atomised tasks in case we want to run them for specialised reasons
module.exports['sass'] = sassTask
module.exports['pkg'] = pkgTask 
module.exports['lintbackend:prod'] = lintBackendProdTask 
module.exports['lintbrowser'] = lintBrowserTask 
module.exports['webpack'] = webpackTask 
module.exports['server'] = serverTask 

// Watchers
module.exports['watch:sass'] = sassWatch
module.exports['watch:js'] = jsWatch

/*
	Dependency tasks run async & simultaneous by default.
	Note: Are your tasks running before the dependencies are complete?
	Make sure your dependency tasks are correctly using the async run hints: take in a callback or return a promise or event stream.
*/