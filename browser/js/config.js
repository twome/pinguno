// In-house
import { Enum } from '../../my-util-iso.js'

// Release environments
let envs = new Enum(['development', 'production', 'staging'])

// TODO make enum isomorphic and use it to set settings
let config = {
	env: envs.development,
	appDomPrefix: 'pn-',
	verbose: 2
}

/*
	Write the current release environement into the DOM, so it's available to:
	- JS not controlled by us (we can just `import` this config file instead of using a pseudo-global)
	- CSS
*/
let htmlEl = document.documentElement
if (htmlEl.dataset.pnBuildEnv) config.env = htmlEl.dataset.pnBuildEnv

export { config, envs }