# Bug list

## Listing bugs here in lieu of a proper bug tracker format/app, so this is portable to different repo/project systems

- readJSONIntoSession is not correctly placing combinedList pings into targets
- readJSONintosession or updatetargetconnectionstatus/updateglobalconnectionstatus is not properly setting last good/bad ping

- [test, mac, nativeping, breaking] after running for long enough on native ping, we stop getting "new" pings (newer than the active log file's) for some reason -- check if this is still happening

- [mac, nativeping] we're not properly cutting extraneous data from json output
	-- log size too big
- [win, devonly] we use `pwd` cli exe for setting env vars before running none
	
- [test]: run with 0, 1, and 10 host targets specified

- [test, fragility] make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls