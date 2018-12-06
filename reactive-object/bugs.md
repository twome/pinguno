# bugs

- if a dependent process is asynchronous and leaves its watcher hanging in the global watcher list for long enough that a *different* property which that specific watcher DOESN'T access is accessed by a *different* watcher, then the dependent process will unnecessarily update.
	- is an asynchronous dependent process even possible to implement well?