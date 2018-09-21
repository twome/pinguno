# Bug list

## Listing bugs here in lieu of a proper bug tracker, so this is portable to different repo/project systems


- unpaired requests are piling up when we go in & out of connection on net-ping engine
	- also stops writing to json log on connection loss (Still seems to store outages tho kinda)
	- doesn't seem to write errorful pings to text log
- net-ping -> raw-socket throws "No route to host" when network adapter off
	- Currently just dealing with this by regexing the error message and classifying as PingData.errorTypes.destinationUnreachableError
- BUG: getting duplicates in saved ping list
	- annoying but not inaccurate for manual inspection until we get to processing/averaging etc the data  
- BUG: make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls