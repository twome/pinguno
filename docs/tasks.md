# Tasks to do:

- add `pre-push` git hook from this repo to global config
- remove `KeyMeta.prototype.value` concept, and instead only read/write to the proxy's target (simpler)
- split CLI-&-includable + GUI client-&-server + reactiveproxy into separate packages in a monorepo; use Lerna to use them together

## GUI

- add list of hard browser requirements, without which it's not worth making fallbacks for. alert user if their browser is insufficient, and inform them that all the features used are in the *standard spec* and the problem is with the browser, not the page code (for easier debugging eg. with their technical support). enumerate the specific features the browser lacks and link to CanIUse.com or MDN browser support matrix

- add HTML5Boilerplate stuff like correct <meta> tags

- learn Vue and render session data with it

- sketch/visual exploration of layout before investing more effort in html structure

- design blueprint:
	- tray icon colour / fullness indicators for when 
		- initialising
		- connection status changes
		- serious user-action-required occurs

	- cmd+click tray icon for simple list (faster, no webkit load, less bug-prone)
		- will need native code (we need anyway to create tray icon)

	- tray mini-window:
		- mouse-over stats preview besides uptime thingo

		- scrollable space for recent fulloutages list
			- default view is all targets; can filter to 1 targetoutage
		- scrollable space for individual ping/failure log
			- default view is all targets; can filter to 1

		- multiline (per target) latency graph (mousewheel to zoom timescale, shift+mw to time-scrub, cmd+mw to zoom latency-scale (vertical), cmd+shift+mw to scroll latency)

		- button: copy session human log to text clipboard
			- ellipsis: 
				- button: open session human log
		- button: copy this session json log to text clipboard
			- ellipsis: 
				- compress and copy all json logs as file clipboard 
				- compress all json logs, copy zip path as text clipboard
				- open this session json log

		- open Pinguno logs folder in file browser

		- display the Pinguno server url (hide if localhost)
			- colour/highlight the port separately
			- click inside the url+port text: swap to using that server's data
				- on success, refresh the mini-window
				- if we don't already have saved auth cache/tokens/whatever, slide out a password entry beneath
			- auto-search for Pinguno servers on the local network, else default to default localhost port
				- how can we do this?

	- optional: sounds play when events occur
		- high-quality, non-intrusive default sound effects
		- drag a .mp3 or .ogg into /sound-effects and rename to specific sound
		- events (mostly we just want these for asynchronous or user-absent events):
			- disconnected
			- reconnect
			- pings getting close to timeout (constant sound with slow fade / pitch modulate)
			- successfully change Pinguno server
		- simple mute & volume control in tray menu

- focus on designing for the mini-window (a kind of quasi-"mobile-first"), and just centre it in huge space / widen the scrollable or graph areas to fill empty space. then we also get hand-screen browsers UI for free

- create mock dataset for UI designing with
	- add a delay in the server to simulate spotty/slow/async data
		- module for this


## Native / OS code

- "invisible" mode - when executed by "run on boot" lists, run without tray icon visible to save clutter
	- clearly tell user which process(es) to look for in Activity Monitor / `ps -e` if they can't get access to a GUI for it due to a bug
	- any time user manually opens program, invisble mode deactivated
	- obviously there's a button to go into invisible mode again in the UI
	- prefpane? service?

- [highpriority] run cli as service / auto-run on boot 
	- look up hands-off rebooting Windows PC like a router (auto log in; auto lock the UI; start on-boot services)
		- could relay these instructions to users looking for that


## CLI

- add & use `meow` for better CL UX

- get more data from system `ping` https://linux.die.net/man/8/ping:
	- `-R` option to record route (max of 9 nodes)
		- from man:
			> Many Hosts and Gateways ignore the RECORD_ROUTE option.
			> The maximum IP header length is too small for options like RECORD_ROUTE to be completely useful. There's not much that 
			> that can be done about this, however.
			It looks like traceroute is the far superior option

	- `-Q` to adjust ToS, Type of Service (adjust for higher network precendence, more reliability etc)
	- `-t` set the IP ttl


## Misc

- [highpriority] stream sessions to file 
	- have human-readable line-by-line output for console output, and machine-readable for console output + collection into JSON etc
	- absolutely necessary for efficient memory usage
	- should we json-stringify each 'chunk'? i guess that might be inefficient but easiest to parse
		- csv line-by-line for each ping response, with special lines for beginnings and deliberate ends of sessions?
	- workaround: simply start a new session whenever mem usage gets too high; starting new session automatically calls a compress-all-logs if log-archive too big (could this be parallel & ignore present session? wait of course it could)

- use quasi-random port. have an order of default ports to test for availability first, then give up and try random ones
	- there *has* to be a community module for this, right?

- for users with an always-on computer: pinguno should prominently display (and make easy to copy) the ping-server's local IP & suggest to bookmark / save as native-webapp (app manifest eg home app icon on phone), so users can easily check, for eg, on phone over wifi
	- if server is running on same computer (ie localhost works)

- fn to find latest failure that also searches requestFailures (as well as pings/responses)

- add option to save config/ shit to ~/.config/pinguno and logs to ~/whereverthehellstandardlogdirectoriesare/ 
- probably rename logs and config dirs to pinguno-logs and pinguno-config to reduce risk of overwriting/clashing with other stuff in same dir

- learn how to process and use command-line arguments in Node to allow options
	OR 
	fully specify all env vars you can use to customise

- compressed archives
	- run automatically when we hit directory size (50MB) and time-interval (28 days

- stretch: test DNS by using domain names after testing IPs

- use an optional flag to turn on an interactive settings prompt before running so the user can override the default settings without needing to attach any flags or write in a config file. offer to save selected settings in a local /config/Pinguno-chosen-settings.json file. 

- [lowpriority] reduce the size of the logs somehow; it's really balooning. reduce duplication

- native/inbuilt ping: method to calculate the time that each request would have been sent
	- pair up ICMPs?
	- can we get any date from `ping`s output using different (for eg) verbosity settings?
	- count in parallel using Pinguno.pingIntervalMs

- "print data straight to console" mode
	- basically same console output as default ping (but more readable)
	- for techy live monitoring

- stretch: add traceroute latency graph (total latency over time and per-IP latency over IP)
	- automatically identify that problem is not with LAN if first hop is constantly <10ms
	- suggest the issue maybe be ISP's fault if total latency is high and large jump in latency occurs in hop 3+

- stretch: phantomJS-like spider to log in and crawl router's web interface (get DSL/analogue line readings when modem-ISP net connection is down to see whether to blame modem's ability, the line, or the ISP's provisions/availability)

- stretch: write to some kind of DB
	- probably a lot faster and less CPU/memory/storage cost than JSON files
	- what kind of scheme?

- stretch: also do an ookla-style real bandwidth test
	- what servers to use?
	- how to measure?

- stretch: add user's text notes to logs (describing if wifi router was power cycling, storm happening, etc)
	- important: show a very simple straightforward example
	- lets everyone better diagnose outage causes

- get min / max / mean / standard deviation of latencies for given time period of *sent and returned* pings
	- stretch: latencies histogram

- stretch: use windows inbuilt ping (for latency accuracy checking)
	- the big problem: custom polling time & capturing / parsing separate ping attemps
		- spawning / closing a new (sub)process for every ping attempt would probably suck ass performance-wise
	- reliably detect windows and insert a /t flag on `ping` to make it ping continuously
	https://stackoverflow.com/questions/9028312/difference-between-ping-on-windows-and-ubuntu
	- also need to parse the following:
	> Reply from 192.168.239.132: bytes=32 time=100ms TTL=124
		- ttl capitalised
		- no space before ms
		- different order
	- how to get ICMP?

- stretch: programatically change/disable OS network settings to simulate changing network contexts 
	- need access to OS network APIs
	- simulate slow/spotty internet using nodeish middleware instead somehow??
	- would be huge advantage for autotesting

- stretch: break apart in-house modules for public repos if it makes sense

- stretch: i18n

- [lowpriority] do we need to perform some actions before ctrl+c fully exits NEED RESEARCH
	- check that we finished properly writing to file?

- stretch: auto-upgrade or one-click upgrade for non-tech users

- implement a stretchable interval (eg shorter interval if we have a bad ping, gradually reduce that over time, reduce interval again upon reconnect 

- reduce pkg binary size by importing only the functions/data we need from dependencies
	- Lodash:
		- cloneDeep
		- concat
		- sortBy
		- isEqual
		- last
		- mean

- [lowpriority] move from SCSS to PostCSS for more flexibility + easier things like autoprefixing

- [lowpriority] gulp pkg: Somehow feed ICU data into exec's env without throwing an error
	- check if we even need to do this (do we use ICU data in any instance of Luxon (DateTime)?)
```
	let iCUDir = p(__dirname, 'node_modules/full-icu')
	env: {
		NODE_ICU_DATA: iCUDir
	}
```


## Project management / organisation / presentation

- Icons for all formats (multi-res macOS, Win, and Unix in-OS icons, high-res website logo, systray icon, B+W menubar icons)


### Promotional website

- clearly explain benefits first
	- harder for ISP to bullshit you
	- ISP support workers also have an interest in getting more accurate data about outages on the user's side, too
		- helpdesk could send customer a link to Pinguno, and with user consent Pinguno could automatically send outages to ISP's server so helpdesk can see that data directly
		- user could specify e.g. 'send this data for one month'
	- close to zero installation & daily usage effort. just forget about it. doesn't take up CPU, doesn't take up space.
- live demo from Pinguno cli running on domain's server
	- open in popup iframe exactly like a menubar Electron window?


## 3rd-party code PRs

- proper error handling for raw-socket within net-ping (don't drop the ball when passing up own errors)
- support getting TTL & response size for response pings


## Checklist for public release:

-[ ] SECURITY: ensure that personal / config / gitignored files are not included in the build
	- how to deal with .env?
	- FAIRLY sure that .env values are "frozen" into the pkg build at build time
	- to let the user use other env vars in perhaps a bundled zip; we can build the relative URL from `process.execPath`
-[ ] SECURITY: sanitize child_process.spawn input properly (extremely important security)
	- Never let a third party set either of the two vars
	- This is currently just to stop the host user accidentally running the wrong command on their command line
	- Unfortunately, we pretty much need to expose user-set variables (1) the polling interval and (2) the IP string to the "spawn" command (the dangerous part). 
-[ ] PRIVACY: Scour all personal/private information added while developing.
-[ ] PRIVACY: Make sure no sensitive user information will be stored or transmitted without user & dev consent
-[ ] UX: Replace links to local-file npm packages with links to publicly-downloadable repos 
-[ ] PERFORMANCE: Concatenate browser code into single compressed files
-[ ] PERFORMANCE: Production-process `browser/public` into `browser/dist`
-[ ] CODE QUALITY: Perform code lints with production settings
-[ ] CODE QUALITY: Remove all TEMP / console.debug / dev comments etc. TODOs are fine if it makes sense and reveal intent.
-[ ] CODE QUALITY: Make sure all "global" npm binaries are installed as package.json dev-dependencies so that `npm run` can use their local `/node_modules/.bin` symlinks.
-[ ] CODE QUALITY: Remove all unnecessary dependencies to reduce install time / size.
-[ ] CODE QUALITY: Check that single-line, single statement 'if' statements are not wrapped in block curlies
-[ ] UX: Ensure readme has no serious inaccurate information.


### Before 1.0.0:
- test suite
- stable server API