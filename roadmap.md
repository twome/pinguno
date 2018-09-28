## To do / roadmap:

### Misc

- refactor the (write/update) JSON log stuff together, and remove the 'partial' rewriting stuff
	- just detect if there's anything new to write (to save HDD writes)
		- if we have a valid "changed session since last saved" property
		- else: deep value-compare live session & readed data
	- we can stitch entire sessions together with very different start/end times
	- if memory is a concern just split the session rather than reconnecting to the existing log file

- test DNS by using domain names after testing IPs

- use an optional flag to turn on an interactive settings prompt before running so the user can override the default settings without needing to attach any flags or write in a config file. offer to save selected settings in a local /config/pingu-chosen-settings.json file. 

- also save last-used pingu settings in /config/pingu-last-settings.json

- reduce the size of the logs somehow; it's really balooning. reduce deuplication

- split ping engines off Pingu into modules

- split logging off Pingu into module

- run as service / auto-run on boot 
	- PERSONAL ONLY: look up hands-off rebooting Windows PC like a router (auto log in; auto lock the UI; start on-boot services)

- method to calculate the time that each request would have been sent
	- pair up ICMPs? do we get an outgoing ICMP?
	- can we get any date from `ping`s output?
	- count in parallel using Pingu.pingIntervalMs

- check if spawn.on('data') is a junk message and if so discard or store differently

- function to decompress all existing zipped archives, concatenate, and then recompress with all other new data (better compression efficiency)

- "print data straight to console" mode
	- basically same console output as default ping (but more readable)
	- for techy live monitoring

- stretch: add PingLogger-style traceroute latency graph (total latency over time and per-IP latency over IP)
	- keep a hold of ICMP_seqs to pair up latency of each IP
	- automatically identify that problem is not with LAN if first hop is constantly <10ms

- make a web front-end to display collected data & adjust settings (ideally w/o restart)
	- needs server API for getting data and receiving commands
	- possible to make low-resource-cost Webkit GUI that only consumes resources when visible (when user is changing options etc), separated from Node server logging?

- phantomJS-like spider to log in and crawl router's web interface (get DSL/analogue line readings when modem-ISP net connection is down to see whether to blame modem's ability, the line, or the ISP's provisions/availability)

- stretch: native mini-displays for Mac & Windows menubar/tray

- write to some kind of DB
	- what kind of scheme?

- stretch: also do an ookla-style real bandwidth test
	- what servers to use?
	- how to measure?

- stretch: add user's text notes to logs (describing if wifi was down, storm happening, etc)
	- important: show a very simple straightforward example

- turn all logs into compressed single archive 
	- save into single file named with date range
	- give options to restrict to size (10MB) and time-interval (30 days)

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
	- simulate slow/shit internet using nodeish middleware instead somehow??
	- would be huge advantage for autotesting

- store TargetOutage pings by ID/reference instead of copied data

- stretch: break apart in-house modules for public repos if it makes sense

- do we need to perform some actions before ctrl+c fully exits NEED RESEARCH
	- check that we finished properly writing to file?

- fragility: make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls

## GUI

## Project management / organisation / presentation

- Make sure all "global" npm binaries are installed as package.json dev-dependencies so that `npm run` can use their local `/node_modules/.bin` symlinks.
- Icons for all formats (multi-res macOS, Win, and Unix in-OS icons, high-res website logo, systray icon, B+W menubar icons)


## 3rd-party code changes

- proper error handling for raw-socket within net-ping (don't drop the ball when passing up own errors)
- support getting TTL & response size for response pings

### NEEDED FOR SELF-USAGE:

- bugfix: the log targets are not getting TargetOutages recorded in their log
	- this doesn't matter that much; you can just look at the raw pings per target

### NEEDED FOR PUBLIC RELEASE:

- SECURITY: ensure that personal / config / gitignored files are not included in the build
	- how to deal with .env?
	- FAIRLY sure that .env values are "frozen" into the pkg build at build time
	- to let the user use other env vars in perhaps a bundled zip; we can build the relative URL from `process.execPath`
- SECURITY: sanitize child_process.spawn input properly (extremely important security)
- remove all temporary / debug / dev comments etc
- PERSONAL: scour all personal information
- helpful readme
- test suite