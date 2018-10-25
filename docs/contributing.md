# Contributing 

Send us a PR or make an issue on GitHub! See `docs/tasks.md` for the current to-do list, or `docs/roadmap.md` [pending] for the long-term overview/goals.

## Versioning 

We use [semantic versioning](https://semver.org/) for releases (tags on the 'master' branch). Please do all non-bugfix development on a branch whose name begins with 'feature/', and do bugfixes directly on 'master'. We will merge PRs into the 'alpha' branch, optionally polish them up in 'beta', and then merge into 'master' for the next public release. We will test bugfixes on 'master' and release them with a bugfix version number increment (x.y.bugfix). Any changes that deliberately remove (rather than refactor or re-style) GUI functionality will increment the major version number.

## Tasks

- We don't have easy access to good Windows and Linux testing machines, so finding bugs on them would be especially useful. Running reliably without user input, for very long periods of times (months), under very diverse network/power conditions, on common machines, is a very high long-term priority. 
- Test data on a wide variety of network conditions is very valuable.
- If you're looking to contributing translations - thank you very much! - but the user interface is not settled enough yet for a translation to be worth your time. We'll update this notice when that changes.

All help is appreciated :) 
Read the contributor's code of conduct at `docs/CODE_OF_CONDUCTING.md` if you want to get a feel for what is appropriate.