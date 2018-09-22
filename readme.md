# Pingu - an ISP uptime logger

## How to use (normal people):

### Installation

- Mac: download [Pingu.app]() and Cmd-click / right-click and select "Open"
- Windows:

### Usage

- Mac: Pingu's icon will appear in the macOS menubar (top-right by default) when Pingu is running. 
- Windows: Pingu's icon will appear in the Windows system tray (bottom-right by default) when Pingu is running.

The icon will appear hollow and/or animate when your internet connection drops. Left- or right- click the icon to open the menu.

*To exit/stop Pingu:* click the menubar/system tray icon and select 'Quit'. This will attempt to exit/stop all background processes that Pingu created as well as the Pingu menubar/system tray app itself.

### Customising

#### Automatically starting Pingu when you log in to your OS
	- Windows: TODO (startup items?)
	- Mac: TODO (part of install script?)
		- Alternatively, go to `System Preferences > Users & Groups > Login Items`, click the `+` sign at the bottom of the list, and select Pingu.app

### Uninstallation

- Windows: 
	- Manually:
		- TODO: Remove from registry
		- Delete Pingu.exe
		- TODO: Delete log locations
	- Automatically:
		- TODO: Uninstaller?

- Mac:
	- Manually:
		- Delete Pingu.app
		- Clean up leftover references to Pingu from `System Preferences > Users & Groups > Login Items`
		- TODO: remove from any required system folders
		- TODO: Delete log locations
	- Automatically:
		- TODO: optional uninstaller run from menubar options?

## How to use (developers):

Pingu is available as a GUI app and a command-line utility.

TODO: the rest

### Git branch details

- master: latest working version for public use. develop must pass existing tests/QA before master merges it in
- develop: latest development version. does not need to work; merge feature branches in once the main gist of the feature is fleshed out)

### Version system

Uses [semantic versioning](https://semver.org/)

### Contributing

TODO

## License: MIT

**Non-legally-binding plain English**:
> You can use Pingu for anything (including commercial uses), as long as you include Pingu's MIT license in whatever copies you make of Pingu (to preserve the original copyright/crediting and ensure copies don't have a different license assigned to them). You get no warranty nor can you hold Pingu's authors liable for anything.

See file 'LICENSE' for full legally-binding details.