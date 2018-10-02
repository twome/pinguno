# Pingu - an ISP uptime logger

## System requirements

Officially supports:
- Windows 10, 64-bit only
- macOS Sierra 10.12.6, 64-bit only

- [Developers only] Node v10.11.0 and up
- [Unix-based systems only] `ping` binary accessible on the $PATH (can fall back to less accurate included 'ping'-like package)

## How to use (normal people):

### Installation

#### Command-line version:
- Mac: download [pingu-cli-macos]() 
- Windows: download [pingu-cli.exe]()

The installation is portable and by default will output JSON and human-readable text log files to `./logs`, creating that directory anew if needed. Apart from that, no other files/directory will be modified by the CLI executable.

#### GUI version:
- Mac: download [Pingu.app]()
- Windows: download [Pinge.exe]()

TODO: portable? registry? global config/cache locations egg $APPDATA, ~/.config/pingu, ~/.cache/pingu

### Usage

NB. Don't forget to change your OS settings so your computer doesn't fall asleep, or Pingu will be unable to log continuously (Pingu can't override that behaviour). Check out this [cross-browser guide](TODO) on locking your computer without putting it to sleep, if you need to do that.

#### CLI version:

- Mac: open `pingu-cli-macos` with Terminal or another command-line app. 
- Windows: run `pingu-cli-win.exe`. It will open a cmd window.

Pingu will begin logging to timestamped files in a directory called 'logs' created next to the executable. `Ctrl+C` to exit. If you want to send logs to your ISP to help troubleshoot your connection, send them all the compressed/zipped files in the local `./logs/compressed/` folder. TODO: automatic zipping.

#### GUI version:

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

### Installation

[Install Node.js v10.11.0](https://nodejs.org/en/download/) or above if you don't have it.
Clone this repo locally: `git clone git@github.com:twome/pingu.git`
TODO: what requires node-gyp?
[Windows only] This project depends on `node-gyp`, so you may need to install `node-gyp`'s dependencies with `npm install --global windows-build-tools`

### Usage as an end-user CLI app

NB. We need to keep some environment variables (listed in init-env-vars.sh) in the shell so Node knows where to look for ICU (locale data, inbuilt in browsers). Run `. init-env-vars.sh` for each shell session, or you can use the `npm run ...` shortcuts in package.json which include the env vars.

Run `node start.js` to start a Pingu session.
Supported environment variables (can use a .env file in project root):
```
NODE_VERBOSE: 0-9 (verbosity of console output)
NODE_ENV: 'production' or 'development' 
```

### Usage as an npm package (for getting Pingu data programmatically)

TODO: publish to GitHub & npm  
`npm install twome/pingu` or `yarn add twome/pingu`
Pingu (pingu.js) is the main class, and session state is stored as properties of Pingu objects.

TODO: Pingu API documentation 

### Building/compiling executables

We use the [`pkg`](https://github.com/zeit/pkg) package & binary to build executables. 
- Run `npm run buildcli` or `yarn run buildcli` to run the multiplatform build script with the --dev dependency `pkg` defined in package.json.
- Alternatively, install `pkg` globally with `npm install -g pkg` or `yarn global add pkg` and run it with your own settings.

### Git branch details

- master: latest working version for public use. develop must pass existing tests/QA before master merges it in
- develop: latest development version. does not need to work; merge feature branches in once the main gist of the feature is fleshed out)


## Further documentations:

See the /docs folder in this repo for Markdown-formatted documentation.
	- bugs.md: the full list of known bugs
	- hacks.md: currently-implemented hacks to be wary of
	- roadmap.md: future development plans

## Known bugs & caveats

- The accuracy of the pings' RTT in milliseconds is currently unknown when using the `net-ping` engine. TODO: quantify. The accuracy of the `ping` engine is the same as the native `ping` binary.
- Can't get TTL or byte size of ping responses when using `net-ping` engine (seemingly not supported by it). Use inbuilt/native `ping` binary if you need this info. 
- TODO: testing DNS

- The ICMP 'ping' format was only designed to check if you can contact a given host, not necessarily to prove that you can connect to the internet, or that all of that host server's functions are working correctly. In most situations, though, being able to ping several unrelated high-availability servers with a low latency (also know as "round-trip time" or RTT) should indicate that you probably have a solid internet connection.
- Pingu does not currently test bandwidth, nor can it tell if something else is consuming lots of bandwidth on your local network (which would normally increase the latency you'd see from all external pings). Use Pingu data from when all network applications are off & your local network has no-one else using it for the best accuracy.
- We have not tested if Pingu or native `ping` binary output is useful or admissible evidence in a legal setting. Ultimately, without cryptographic methods of proving which computers saw/wrote what, it would be relatively simple for a very computer-literate person to "doctor"/forge the output of Pingu. This means it may be hard for you to use Pingu to legally force your ISP to provide better service or get a refund etc. At the very least, it could help your ISP to identify the precise times and causes of your internet outages, or stop your ISP from "gaslighting" you by lying to you that the fault is on your end -- in which case, you'd instead have the info you need to look for a different ISP, or attempt to publicise your issue to apply marketing/social pressure on your ISP to help you.

## Administration things

### Version system

Uses [semantic versioning](https://semver.org/)

### Error reporting & contributing

Send us a PR or make an issue on GitHub! All help is appreciated :)

### Contributors:

Tom Kenny - [website](https://twome.name)

## License: MIT

**Non-legally-binding plain English**:
> You can use Pingu for anything (including commercial uses), as long as you don't remove Pingu's MIT license from whatever copies you make of Pingu (to preserve the original copyright/crediting and ensure copies don't have a different license assigned to them). You get no warranty, nor can you hold Pingu's authors liable for anything Pingu does. It's free, so if someone's charging you money for basically the same thing you're probably getting ripped off!

See file '[LICENSE](LICENSE)' for full legally-binding details.