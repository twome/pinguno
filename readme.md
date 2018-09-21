## To do:

### Misc

- run as service / auto-run on boot 
	- PERSONAL ONLY: look up hands-off rebooting Windows PC like a router (auto log in; auto lock the UI; start on-boot services)

- method to calculate the time that each request would have been sent
	- pair up ICMPs? do we get an outgoing ICMP?
	- can we get any date from `ping`s output?
	- count in parallel using Pingu.pingIntervalMs


- BUG: getting duplicates in saved ping list
	- annoying but not inaccurate for manual inspection until we get to processing/averaging etc the data  

- BUG: make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls

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

### NEEDED FOR SELF-USAGE:

- WHY CAN'T WE ACCESS DEPENDENCIES IN net-ping???

- error type prop in pingdata 
	- print human explanation in text summary

- replace .timeout prop with failure bool and errorType

- session ended time in json+human logs

- bugfix: ICMP not being recorded 
- bugfix: smooth display in human-text summary for unknown values
- bugfix: the log targets are not getting TargetOutages recorded in their log
- bugfix: outages completely broken for net-ping engine

- bugfix: nativePing updateOutage isn't recognising an outage that is continuing until the present (or the very last ping)
	- HAPPENS IF YOU START DISCONNECTED TOO - ONLY RECOGNISES OUTAGE AFTER RECONNECTING 
	- probably isn't creating a trailing targetOutage
