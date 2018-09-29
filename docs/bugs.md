# Bug list

## Listing bugs here in lieu of a proper bug tracker, so this is portable to different repo/project systems

- mac, nativeping: we're not properly cutting extraneous data from json output
- netping: bad pings are being put into JSON as just object w/ an icmpseq

- not creating 'bad' pings; how will targetoutages and therefore fulloutages detection work?

- readJSONIntoSession is not correctly placing combinedList pings into targets

- after running for long enough on native ping, we stop getting "new" pings (newer than the active log file's) for some reason

- BUG: getting duplicates in saved ping list
	- annoying but not inaccurate for manual inspection until we get to processing/averaging etc the data  


- win, devonly - we use `pwd` cli exe for setting env vars before running none