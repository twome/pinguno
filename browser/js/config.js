// In-house
import { Enum } from '../../util-iso.js'

// Release environments
let envs = new Enum(['development', 'production', 'staging'])

let config = {
	env: envs.production, // Production by default (for safety)
	appDomPrefix: 'pn-',
	verbose: 2
}

/*
	Read the current release environment from the DOM (written by server templating). This is also available to:
	- JS not controlled by us (we can just `import` this config file instead of using a pseudo-global)
	- CSS
*/
let htmlElAttrName = config.appDomPrefix.slice(0, config.appDomPrefix.length - 1) + 'BuildEnv'
let htmlEl = document.documentElement
if (htmlEl.dataset[htmlElAttrName]) config.env = htmlEl.dataset[htmlElAttrName]

if (config.verbose >= 2) console.info('[config] Release environment: ', config.env)

export { config, envs }