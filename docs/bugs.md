# Bug list

## Listing bugs here in lieu of a proper bug tracker format/app, so this is portable to different repo/project systems

- [breaking] subprocesses do not auto-exit after losing their parent, so if the parent exits without properly cleaning up its children, then the subprocesses run ad infinitum

- [breaking] we store entire sessions in-memory rather than streaming them to files
	- this rules out long-term logging until fixed

- [test, mac, nativeping, breaking] after running for long enough on native ping, we stop getting "new" pings (newer than the active log file's) for some reason -- check if this is still happening

- [dev-only, gulp] hitting ctrl+C leaves the server child-process running, which interferes with ports 

- have to repeatedly hit Ctrl+C to properly exit (chokidar/nodemon/process.spawn subprocesses?)

- does uptime calculate the time-span of each ping/failure? it needs to do that rather than just assuming every ping covers the same amount of up/downtime

- readJSONIntoSession is not correctly placing combinedList pings into targets
- readJSONintosession or updatetargetconnectionstatus/updateglobalconnectionstatus is not properly setting last good/bad ping

- [mac, nativeping] we're not properly cutting extraneous data from json output
	-- log size too big
- [win, devonly] we use `pwd` cli exe for setting env vars before running none
	
- [test]: run with 0, 1, and 10 host targets specified

- [test, fragility] make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls