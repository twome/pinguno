## To do / roadmap:

## GUI

- create mock dataset for UI designing with
	- add a delay in the server to simulate spotty/slow/async data

- design blueprint:
	- tray icon colour / fullness indicators for when 
		- initialising
		- connection status changes
		- serious user-action-required occurs

	- cmd+click tray icon for simple list (faster, no webkit load, less bug-prone)
		- will need native code (we need anyway to create tray icon)

	- optional: sounds play when events occur
		- high-quality, non-intrusive default sound effects
		- drag a .mp3 or .ogg into /sound-effects and rename to specific sound
		- events (mostly we just want these for asynchronous or user-absent events):
			- disconnected
			- reconnect
			- pings getting close to timeout (constant sound with slow fade / pitch modulate)
			- successfully change Pinguno server
		- simple mute & volume control in tray menu

	- tray mini-window:
		- scrollable space for recent fulloutages list
			- default view is all targets; can filter to 1 targetoutage
		- scrollable space for individual ping/failure log
			- default view is all targets; can filter to 1

		- multiline (per target) latency graph (mousewheel to zoom timescale, shift+mw to time-scrub, cmd+mw to zoom latency-scale (vertical), cmd+shift+mw to scroll latency)

		- prominent uptime

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
	

- figure out if it's worth using electron instead of simply opening a browser tab
	- pros: tiny, neat, frameless window for rendering next to tray icon?

- focus on designing for the mini-window (a kind of quasi-"mobile-first"), and just centre it in huge space / widen the scrollable or graph areas to fill empty space. then we also get hand-screen browsers UI for free

- "invisible" mode - when executed by "run on boot" lists, run without tray icon visible to save clutter
	- clearly tell user which process(es) to look for in Activity Monitor / `ps -e` if they can't get access to a GUI for it due to a bug
	- any time user manually opens program, invisble mode deactivated
	- obviously there's a button to go into invisible mode again in the UI

### Misc

- [highpriority] learn how to process and use command-line arguments in Node to allow options

- [highpriority] make a web front-end to display collected data & adjust settings (ideally w/o restart)
	- needs server API for getting data and receiving commands
	- possible to make low-resource-cost Webkit GUI that only consumes resources when visible (when user is changing options etc), separated from Node server logging?

- [highpriority] run cli as service / auto-run on boot 
	- look up hands-off rebooting Windows PC like a router (auto log in; auto lock the UI; start on-boot services)
		- could relay these instructions to users looking for that

- compressed archives
	- run automatically when we hit directory size (50MB) and time-interval (28 days

- stretch: test DNS by using domain names after testing IPs

- use an optional flag to turn on an interactive settings prompt before running so the user can override the default settings without needing to attach any flags or write in a config file. offer to save selected settings in a local /config/Pinguno-chosen-settings.json file. 

- [lowpriority] reduce the size of the logs somehow; it's really balooning. reduce duplication

- native/inbuilt ping: method to calculate the time that each request would have been sent
	- pair up ICMPs?
	- can we get any date from `ping`s output using different (for eg) verbosity settings?
	- count in parallel using Pinguno.pingIntervalMs

- stretch: "print data straight to console" mode
	- basically same console output as default ping (but more readable)
	- for techy live monitoring

- stretch: add traceroute latency graph (total latency over time and per-IP latency over IP)
	- automatically identify that problem is not with LAN if first hop is constantly <10ms
	- suggest the issue maybe be ISP's fault if total latency is high and large jump in latency occurs in hop 3+

- stretch: phantomJS-like spider to log in and crawl router's web interface (get DSL/analogue line readings when modem-ISP net connection is down to see whether to blame modem's ability, the line, or the ISP's provisions/availability)

- stretch: native mini-displays for Mac & Windows menubar/tray

- stretch: write to some kind of DB
	- probably a lot faster and less CPU/memory cost than JSON files
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

- implement a stretchable interval (eg shorter interval if we have a bad ping, gradually reduce that over time, reduce interval again upon reconnect )

- reduce pkg binary size by importing only the functions/data we need from dependencies
	- Lodash:
		- cloneDeep
		- concat
		- sortBy
		- isEqual
		- last
		- mean

## Project management / organisation / presentation

- Icons for all formats (multi-res macOS, Win, and Unix in-OS icons, high-res website logo, systray icon, B+W menubar icons)

### Promotional website

- clearly explain benefits first
	- harder for ISP to bullshit you
	- close to zero installation & daily usage effort. just forget about it. doesn't take up CPU, doesn't take up space.
- live demo from Pinguno cli running on domain's server
	- open in popup iframe exactly like a menubar Electron window?

## 3rd-party code propositions

- proper error handling for raw-socket within net-ping (don't drop the ball when passing up own errors)
- support getting TTL & response size for response pings

### Checklist for public release:

-[ ] SECURITY: ensure that personal / config / gitignored files are not included in the build
	- how to deal with .env?
	- FAIRLY sure that .env values are "frozen" into the pkg build at build time
	- to let the user use other env vars in perhaps a bundled zip; we can build the relative URL from `process.execPath`
-[ ] SECURITY: sanitize child_process.spawn input properly (extremely important security)
	- Never let a third party set either of the two vars
	- This is currently just to stop the host user accidentally running the wrong command on their command line
	- Unfortunately, we pretty much need to expose user-set variables (1) the polling interval and (2) the IP string to the "spawn" command (the dangerous part). 
-[ ] CODE QUALITY: Remove all TEMP / console.debug / dev comments etc. TODOs are fine if it makes sense and reveal intent.
-[ ] CODE QUALITY: Make sure all "global" npm binaries are installed as package.json dev-dependencies so that `npm run` can use their local `/node_modules/.bin` symlinks.
-[ ] CODE QUALITY: Remove all unnecessary dependencies to reduce install time / size.
-[ ] PRIVACY: Scour all personal/private information added while developing.
-
-[ ] UX: Ensure readme has no serious inaccurate information.

#### Before 1.0.0:
- test suite