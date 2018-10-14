// TODO make enum isomorphic and use it to set settings
let config = {
	env: 'development',
	appDomPrefix: 'pn-'
}

let htmlEl = document.documentElement
if (htmlEl.dataset.pnBuildEnv) config.env = htmlEl.dataset.pnBuildEnv

export default config