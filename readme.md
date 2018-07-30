## To do:

- addOutage()

- find cross-platform binaries of ping to bundle with app, or an npm one (w dependency management builtin)
	- add instructions in-app if must be done by user

- run as service / auto-run on boot

- how to make mac menubar icon / windows tray icon?

- BUG: getting duplicates in saved ping list

- PROOFING: make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls


- server API to change settings and check current connectivity

- possible to make low-signature Webkit GUI that only consumes resources when visible (changing options etc), separated from Node server logging?




- write to some kind of DB
	- what kind of scheme?






- format logs into readable plain-text digest and export to plain text file


- render a latency-over-time graph


- stretch: also do an ookla-style real bandwidth test
	- what servers to use?
	- how to measure?


- stretch: add user's text notes to logs (describing if wifi was down, storm happening, etc)
	- important: show a very simple straightforward example



- turn all logs into compressed single archive 
	
	- parse, 
	- concat into array, 
	- iterate and find earliest and latest dates,
	- stringify, 
	- gzip, 
	- save into single file named with date range

	- give options to restrict to size (10MB) and time-interval (30 days)

- POSSIBLE BUG: if mkdir/file writes fail because they lack write privileges or files are busy