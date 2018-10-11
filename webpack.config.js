const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'browser/public/scripts')
		// TODO: sourcemaps?
	},
	devtool: process.env.NODE_ENV === 'development' ? undefined : 'source-map',
	mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
	entry: [
		path.join(__dirname, 'browser/js/entry.js'),
		path.join(__dirname, 'browser/js/live-reload-custom.esm.js'),
	]
}