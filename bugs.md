# Bug list

## Listing bugs here in lieu of a proper bug tracker, so this is portable to different repo/project systems

- log files go to ~/logs/ when exe can't find local logs/ dir 
	- right-click 'open' with terminal goes to ~/logs regardless of exe location
	- running exe from existing iterm shell in project root puts in project/logs
	- running exe from existing iterm shell in project/build puts in project/logs -- wtf??
		- **uses shell's cwd in some way**? - use node path methods

- json logs not getting outages

- BUG: getting duplicates in saved ping list
	- annoying but not inaccurate for manual inspection until we get to processing/averaging etc the data  
