# Bug list

## Listing bugs here in lieu of a proper bug tracker, so this is portable to different repo/project systems

- BUG: getting duplicates in saved ping list
	- annoying but not inaccurate for manual inspection until we get to processing/averaging etc the data  
- BUG: make sure we don't try to write to a file while already writing to a file
	- asyncify the write calls
