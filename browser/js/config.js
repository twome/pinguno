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
	Read the current release environment from the DOM (written by server templating). This is also available to:
	- JS not controlled by us (we can just `import` this config file instead of using a pseudo-global)
	- CSS
*/
let htmlElAttrName = config.appDomPrefix.slice(0, config.appDomPrefix.length - 1) + 'BuildEnv'
console.debug('htmlElAttrName', htmlElAttrName)
let htmlEl = document.documentElement
if (htmlEl.dataset[htmlElAttrName]) config.env = htmlEl.dataset[htmlElAttrName]

export { config, envs }