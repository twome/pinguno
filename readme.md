# Pinguno - a personal internet uptime logger

Pinguno is an app that continually "pings" a set of IP addresses and logs all the data in both human-readable and structured (JSON) formats.  If you have troubles with the quality of your internet connection, you can use Pinguno's timestamped data to get better tech support (and hopefully a little more transparency) from your ISP, because you can identify all the exact times when your internet dropped. Pinguno is cross-platform, portable, runs on Node.js (included in the app download), and has a command-line interface.

System requirements:

- Windows 10 and up, 64-bit only
- macOS Sierra 10.12.6 and up, 64-bit only
- **[Developers only]** Node.js v10.11.0 and up
- **[Unix-based systems only]** `ping` binary accessible on the $PATH (you almost certainly have this, and a less accurate fallback is provided)

By default, it'll output [JSON](https://en.wikipedia.org/wiki/JSON) and human-readable text log files to a `logs` directory created next to the executable, and will store its last-used configuration settings in a `config` directory created next to the executable. Apart from that, no other files/directories will be modified by the app.

### Usage

NB: If you want to monitor your internet connection 24/7, don't forget to change your OS settings so your computer doesn't fall asleep; Pinguno can't run while the computer's in sleep/hibernation. 

#### Using the binaries:

##### Mac:
- Download [pinguno-macos](/releases/download/v0.2.0/pinguno-macos) 
- Open `pinguno-macos` with Terminal or another command-line app.

##### Windows:
- Download [pinguno.exe](/releases/download/v0.2.0/pinguno-win.exe)
- Run `pinguno-win.exe`. It will open a cmd window.

#### Using Node + the source code:

[Install Node.js v10.11.0](https://nodejs.org/en/download/) or above if you don't have it.

**[Windows only]** This project depends on `node-gyp`, so you may need to install `node-gyp`'s dependencies with `npm install --global windows-build-tools`

Clone this repo locally: `git clone git@github.com:twome/pinguno.git`

Run `node start` from the package directory. 

To compress all the current logs into a gzipped archive, run `npm run compressall`. 

Pinguno's settings are handled through environment variables rather than command-line flags (for now, at least). Pinguno will check for a `.env` file in the project root. These are the currently supported settings:

- NODE_VERBOSE: 0-9 (verbosity of console output)
- NODE_ENV: 'production' or 'development' 

If you encounter an error related to "ICU", you may need to have some environment variables (listed in init-env-vars.sh) present in the shell, so that Node knows where to look for "ICU data" (locale data, inbuilt in browsers). Run `. init-env-vars.sh` for each shell session, or you can use the `npm run …` shortcuts in package.json which include the env vars.

---

Pinguno will begin pinging & logging, and will run indefinitely until you press `Control+C` to exit.

### Uninstallation

- Binaries: Delete the binary and the 'config' and 'logs' folders in the same directory as it.
- Node + source code: Delete the package folder

That's it!

### Using Pinguno programmatically

**Note - this is pending publishing to npm**. `npm install twome/pinguno` or `yarn add twome/pinguno`
 "Pinguno" is the main operative class, and logging session state is stored as properties of Pinguno instances.

```
const Pinguno = require('pinguno')
let instance = new Pinguno()
```

#### Pinguno.prototype.startPinging(*Array* **targets** [, *PingEngineEnum* **engine**])

This will start one of the pinging "engines" (such as a wrapper around the inbuilt OS `ping` command, or the `node-net-ping` package). "Targets" must be specified as objects with the properties `humanName` and `IPV4`, both strings.

Current engines available are *NodeNetPing* and *InbuiltSpawn*; both are properties of `Pinguno.pingEngineEnum`. Pinguno will default to InbuiltSpawn on macOS/UNIX-like machines, and NodeNetPing on Windows.

```
instance.startPinging([
	{
		humanName: 'Google',
		IPV4: '8.8.8.8'
	},{
		humanName: 'CenturyLink', 
		IPV4: '4.2.2.2'
	}
])
```

#### Pinguno.prototype.updateSessionStats()

Returns an object describing average connection statistics per target IP, such as uptime, mean latency (round-trip-time) etc.

#### Pinguno.prototype.pingTargets 

Contains all the raw structured data for the pings we've made during this Pinguno session, organised per target IP. See `ping-formats.js` for the data structures we use.

### Building/compiling executables

We use the [`pkg`](https://github.com/zeit/pkg) package & binary to build executables. 
- Run `npm run buildcli` or `yarn run buildcli` to run the multiplatform build script with the development-dependency `pkg` defined in package.json.
- Alternatively, install `pkg` globally with `npm install -g pkg` or `yarn global add pkg` and run it with your own settings.

## Caveats

- Currently only supports IPv4 (IPv6 support is a high short-term roadmap priority)
- The **accuracy of the pings' RTT in milliseconds is currently unknown when using the `net-ping` engine**. The accuracy of the `ping` engine is the same as the native `ping` binary.
- We **can't get TTL or byte size of ping responses when using `net-ping` engine** (that information is seemingly not supported by it), which is used by default on Windows. Use the inbuilt/native ping engine if you need this info - on Windows, you will need to use a UNIX-like alternative ping binary in your $PATH. 
- The ICMP 'ping' format was only designed to check if you can contact a given host, not necessarily to prove that you can connect to the internet, or that all of that host server's functions are working correctly. In most situations, though, being able to ping several unrelated high-availability servers with a low latency (also know as "round-trip time" or RTT) should indicate that you probably have a solid internet connection.
- Pinguno **does not currently test bandwidth**, nor can it tell if something else is consuming lots of bandwidth on your local network (which would normally increase the latency you'd see from all external pings). Use Pinguno data from when all network applications are off & your local network has no-one else using it for the best accuracy.
- We have not tested if Pinguno or native `ping` binary output is useful or admissible evidence in a legal setting. Ultimately, without cryptographic methods of proving which computers saw/wrote what, it would be relatively simple for a very computer-literate person to "doctor"/forge the output of Pinguno. This means it may be hard for you to use Pinguno to legally pressure your ISP to provide better service or get compensation. At the very least, it could help your ISP to identify the precise times and causes of your internet outages, or stop your ISP from "gaslighting" you by lying to you that the fault is on your end -- in which case, you'd instead have the info you need to look for a different ISP, or attempt to publicise your issue to apply marketing/social pressure on your ISP to help you.
- Servers may detect that a specific IP address is repeatedly sending them ICMP packets, and they may choose to respond to this at different points in their network in different ways (such as with a CDN cache), which will impact statistics such as TTL and latency.

## Further documentations:

See the `docs` folder in this repo for Markdown-formatted documentation.

- **changelog.md**: brief summaries of important changes between releases (commits to the `master` branch)
- **bugs.md**: the full list of known bugs
- **hacks.md**: currently-implemented hacks/workarounds to be wary of
- **roadmap.md**: [pending] future development plans - Pinguno is planned to be a very simple menubar/tray app for non-technical users.

## Error reporting & contributing

We use [semantic versioning](https://semver.org/) for releases (tags on the 'master' branch). Send us a PR, or make an issue on GitHub!
All help is appreciated :)

For contributing labour to Pinguno directly, please see `docs/contributing.md`.

## Contributors:

Tom Kenny - [[website](https://twome.name)] - [[source-of-labour statement](https://gist.github.com/twome/1fded3a4534043ab705a0ae2b8ee6ab6)]

## Similar projects:

### Free / open source:

- [watchmen](https://github.com/iloire/watchmen) by Iván Loire & contributors: Web GUI, multiple server support, mature project, developer-focused. Pinguno has slightly different goals: to be a very simple and low-maintenance tray/menubar app for non-technical users to get information/transparency about their personal/physical internet connection (not their server fleet) over long periods of time. If you're looking for more professional DevOps monitoring, watchmen is more feature-rich.
- [node-monitor](https://github.com/qawemlilo/node-monitor#readme) and [node-ping](https://github.com/qawemlilo/node-ping) by Qawelesizwe Mlilo: CLI, website monitoring, event-focused. These are focused more on automatically alerting website maintainers when connection status changes.

### Paid / closed source:

- [Net Uptime Monitor](https://netuptimemonitor.com/) by Becker Software LLC. $10 USD for permanent license, as of 2018-10-04. Windows-only, GUI, focused on non-technical users. Similar in design goals to Pinguno.

## User privacy disclosure

- Pinguno stores your OS username & the full (absolute) URIs of its own folder. These are stored in the logs and config files it generates. It needs these paths in order to read and write from the filesystem.
- Pinguno does not "phone home" (automatically send any information over the internet to its developers or anyone else).

Pingu may, in future, store the following information in its logs (we will do our best to update the disclosure when functionality changes):

- Internal IP address
- Current public IP address
- Info about your current ISP
- Info about network adapters

## License: MIT

**Non-legally-binding plain English**:
> You can use Pinguno for anything (including commercial uses), as long as you don't remove Pinguno's MIT license from whatever copies you make of Pinguno (to preserve the original copyright/crediting and ensure copies don't have a different license assigned to them). You get no warranty, nor can you hold Pinguno's authors liable for anything Pinguno does. It's free, so if someone's charging you money for basically the same thing you're probably getting ripped off!

See 'LICENSE' file for full legally-binding details.