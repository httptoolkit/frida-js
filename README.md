# Frida-JS [![Build Status](https://github.com/httptoolkit/frida-js/workflows/CI/badge.svg)](https://github.com/httptoolkit/frida-js/actions) [![Available on NPM](https://img.shields.io/npm/v/frida-js.svg)](https://npmjs.com/package/frida-js) [![Funded by NLnet - NGI Zero Entrust](https://img.shields.io/badge/Funded%20by%20NLnet-NGI%20Zero%20Entrust-98bf00?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjcuNCAxNjguMiI%2BPHBhdGggZD0iTTEyNyA0NC45YzEuNC0xMS0xLjMtMjAuOC04LjEtMjkuNVMxMDMuMiAxLjcgOTIuMi40cy0yMC43IDEuMi0yOS40IDhBMzggMzggMCAwIDAgNDggMzIuNmwtLjQgMi41LS4yIDIuNWEzOS4zIDM5LjMgMCAwIDAgOC40IDI3QTM4IDM4IDAgMCAwIDgwIDc5LjNsMi40LjQgMS4zLjJhNDQgNDQgMCAwIDEgNS4yLTEyLjQgMzguMSAzOC4xIDAgMCAxLTQuNy0uMUg4NEEyNi41IDI2LjUgMCAwIDEgNjUuNyA1NyAyNi41IDI2LjUgMCAwIDEgNjAgNDJhMjcuOCAyNy44IDAgMCAxIC4yLTUuM3YtLjJjMS03LjUgNC40LTEzLjUgMTAuNC0xOC4xYTI2IDI2IDAgMCAxIDIwLjItNS42IDI2IDI2IDAgMCAxIDE4LjMgMTAuMyAyNyAyNyAwIDAgMSA0LjcgMjUuMWM0LjItMS4zIDguNi0yIDEzLjItMmwuMi0xLjN6bTUuMyA2LjYtMi41LS4zYTM5LjQgMzkuNCAwIDAgMC0yNyA4LjVBMzguNCAzOC40IDAgMCAwIDg4IDgzLjhjNC4zLjggOC4zIDIgMTIgMy45YTI2LjUgMjYuNSAwIDAgMSAxMC4zLTE4LjFjNC42LTMuNiA5LjYtNS42IDE1LTZhMjcuOCAyNy44IDAgMCAxIDUuNC4zaC4xYzcuNSAxIDEzLjUgNC40IDE4LjIgMTAuNGEyNiAyNiAwIDAgMSA1LjYgMjAuMiAyNy4zIDI3LjMgMCAwIDEtMzAuNSAyNGMuOSA0IDEuMSA4LjMuOCAxMi43IDEwIC42IDE5LTIuMiAyNy04LjVBMzguNiAzOC42IDAgMCAwIDE2NyA5Ni4xYzEuNC0xMS0xLjQtMjAuOC04LjItMjkuNS02LjMtOC0xNC4zLTEzLTI0LjEtMTQuN2wtMi41LS40ek0xMjkgNzguN2MtMy40LS40LTYuNS41LTkuMiAyLjZzLTQuMyA1LTQuNyA4LjNjLS41IDMuNS40IDYuNSAyLjUgOS4zczUgNC4zIDguNCA0LjdjMy40LjQgNi40LS40IDkuMi0yLjZzNC4zLTQuOSA0LjctOC4zYy40LTMuNC0uNC02LjUtMi42LTkuMnMtNC45LTQuMy04LjMtNC44em0tMTE2LTVjLjktNy42IDQuMy0xMy44IDEwLjMtMTguNCA2LTQuNyAxMi43LTYuNiAyMC4xLTUuNmE0NC4zIDQ0LjMgMCAwIDEtLjgtMTIuNyAzOCAzOCAwIDAgMC0yNyA4LjRDNi44IDUyLjIgMS44IDYxLjEuNSA3Mi4xczEuMyAyMC43IDguMSAyOS41YTM4IDM4IDAgMCAwIDI0LjIgMTQuN2wyLjQuNCAyLjUuMmM0LjYuMyA5LS4xIDEzLjItMS4zQTQxLjYgNDEuNiAwIDAgMCA3NSA5Ni44YTM4IDM4IDAgMCAwIDQuNC0xMi41Yy00LjMtLjctOC4zLTItMTItMy44YTI2LjUgMjYuNSAwIDAgMS0xMC4zIDE4LjEgMjYuNiAyNi42IDAgMCAxLTIwLjMgNS43aC0uMmMtNy40LTEtMTMuNS00LjUtMTguMS0xMC40LTQuNy02LTYuNi0xMi44LTUuNy0yMC4zek0zMi40IDY3YTEyIDEyIDAgMCAwLTQuOCA4LjQgMTIgMTIgMCAwIDAgMi42IDkuMSAxMiAxMiAwIDAgMCA4LjMgNC44IDEyLjUgMTIuNSAwIDAgMCAxNC0xMC45Yy40LTMuNC0uNC02LjUtMi42LTkuMmExMS45IDExLjkgMCAwIDAtOC4zLTQuN2MtMy41LS41LTYuNS40LTkuMiAyLjV6bTY0LjgtMzQuOGExMiAxMiAwIDAgMC04LjQtNC43Yy0zLjQtLjQtNi41LjQtOS4xIDIuNmExMS44IDExLjggMCAwIDAtNC44IDguM2MtLjQgMy40LjUgNi41IDIuNiA5LjIgMi4xIDIuNyA0LjkgNC4zIDguMyA0LjggMy40LjMgNi40LS41IDkuMi0yLjYgMi43LTIuMiA0LjMtNSA0LjctOC4zLjQtMy41LS40LTYuNi0yLjUtOS4zek04NSA4OC40bC0xLjMtLjFhNDIuMyA0Mi4zIDAgMCAxLTUuMSAxMi4zYzEuNSAwIDMuMSAwIDQuNy4yaC4yYTI2LjQgMjYuNCAwIDAgMSAxOC4zIDEwLjRjMy42IDQuNSA1LjUgOS41IDUuOCAxNWEyNy45IDI3LjkgMCAwIDEtLjIgNS4zdi4yYy0xIDcuNC00LjQgMTMuNS0xMC4zIDE4LjEtNiA0LjctMTIuOCA2LjUtMjAuMyA1LjZzLTEzLjYtNC40LTE4LjMtMTAuM2EyNi4zIDI2LjMgMCAwIDEtNC42LTI1LjJjLTQuMiAxLjQtOC42IDItMTMuMiAybC0uMiAxLjRhMzguNCAzOC40IDAgMCAwIDguMiAyOS40YzYuOCA4LjcgMTUuNyAxMy44IDI2LjYgMTUuMXMyMC43LTEuNCAyOS41LTguMmM4LTYuMyAxMy0xNC4zIDE0LjctMjQuMWwuNC0yLjUuMi0yLjRhMzkuNSAzOS41IDAgMCAwLTMyLjYtNDEuOGwtMi41LS40em01IDMyYTEyLjEgMTIuMSAwIDAgMC04LjQtNC43IDEyIDEyIDAgMCAwLTkuMSAyLjYgMTIuMSAxMi4xIDAgMCAwLTQuOCA4LjMgMTIgMTIgMCAwIDAgMi42IDkuMmMyLjEgMi44IDQuOSA0LjMgOC4zIDQuN2ExMi40IDEyLjQgMCAwIDAgMTMuOS0xMC45Yy40LTMuNC0uNC02LjQtMi41LTkuMnoiLz48L3N2Zz4%3D&labelColor=ffffff)](https://nlnet.nl/project/AppInterception/)

> _Part of [HTTP Toolkit](https://httptoolkit.com): powerful tools for building, testing & debugging HTTP(S)_

Pure-JS bindings to control Frida from node.js &amp; browsers.

This module provides access to Frida, without bundling Frida itself. That means no native binaries included, no compilation required, and no heavyweight files. This works by making WebSocket connections (supported in Frida v15+) directly to an existing Frida instance elsewhere.

This is particularly useful in mobile device scenarios, as you can now run Frida purely on the device (as an Android/iOS Frida server instance, or using Frida-Gadget embedded in a specific application) and connect to it through using this library as a tiny client in Node.js or a browser elsewhere.

Using this library you can:

* Easily download a ready-to-use Frida server binary for any target platform
* Connect to a local or remote Frida server
* Enumerate the target processes available to that server
* Attach to an existing running process, and inject arbitrary code
* Launch a new process, injecting arbitrary code to run before it starts

---

This library is part of [a broader HTTP Toolkit project](https://httptoolkit.com/blog/frida-mobile-interception-funding/), funded through the [NGI Zero Entrust Fund](https://nlnet.nl/entrust), established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more on the [NLnet project page](https://nlnet.nl/project/AppInterception/).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0Entrust_tag.svg" alt="NGI Zero Entrust Logo" width="20%" />](https://nlnet.nl/entrust)

---

## Getting Started

```bash
npm install frida-js
```

### Setting up Frida

First, you'll need a v15+ Frida instance to connect to.

If you don't have this already, you'll first want to download, extract & run the `frida-server` release for your platform from https://github.com/frida/frida/releases/latest, either manually or using the `downloadFridaServer` method, like so:

```javascript
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';

import { downloadFridaServer } from 'frida-js';

downloadFridaServer({ version: 'latest' }) // Downloads for your current platform & arch by default
.then((fridaServerStream) => {
    fridaServerStream
    .pipe(createWriteStream('./frida-server')) // Add .exe to filename on Windows
    .on('finish', async () => {
        await fs.chmod('./frida-server', 0o755); // Make Frida executable (Mac/Linux)
        // You can now run ./frida-server to start up Frida.
    });
});
```

Although the library in general supports both Node & browsers, you'll need typically Node or manual setup for this initial step, before you use a browser to connect.

If you're doing this in production, you may want to use fixed parameters and SRI to guarantee the content of the download - see the options below for more information.

### Controlling Frida

Frida-JS supports both local & remote Frida instances, but doesn't do automated tunnelling over USB or ADB, and so mobile devices will require setup to expose the Frida port (27042) so that it's accessible to this client.

Once you have a running accessible Frida server, to use Frida-JS you first call the exported `connect()` method and wait for the returned promise to get a FridaClient, and then call the methods there to query the available targets and hook them (full API listing below). For example:

```javascript
import { connect } from 'frida-js';

const fridaClient = await connect();

await fridaClient.spawnWithScript(
    '/usr/bin/your-target-bin',
    ['some', 'arguments'],
    `
        const targetFn = DebugSymbol.fromName('a_target_function');

        // Hook the target function and replace the argument
        Interceptor.attach(ptr(targetFn.address), {
            onEnter(args) {
                // Modify your target functions args
            },
            onLeave(retval) {
                // Or return value
            }
        });
    `
);
```

To connect to a remote instance (such as a mobile device) you can pass options to `connect()`, such as `connect({ host: 'localhost:27042' })`.

See the full API reference below for more details of the Frida APIs exposed, or see the test suite for a selection of working examples, and fixture binaries to test against. The code for the fixtures is also provided (in `test/fixture-setup`). Each fixture is a tiny Rust application that can be built by running `cargo build` in its directory (assuming you have a Rust toolchain installed locally).

## Frida Caveats

There are a few general Frida issues you might commonly run into while using this library, documented here for easier troubleshooting:

* On Linux, to attach to non-child processes with Frida, you will need to set `ptrace_scope` to `0`. You can do so with this command:
    ```bash
    sudo sysctl kernel.yama.ptrace_scope=0
    ```
* To use Frida in Docker, you will need to disable seccomp and enable PTRACE capabilities, like so:
    ```bash
    docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined <...>
    ```
    Alternatively, in some scenarios you might want to just set `--privileged` instead.

## API reference

### `FridaJS.downloadFridaServer(options)`

Downloads a Frida server binary for a specific version & target platform (specified in the options). This returns a Node.js readable stream for the binary, which can be either written to a file locally or streamed elsewhere (e.g. via ADB push to an Android device).

The options are:

* `version` - *Required* - The version of Frida server to download. This can be either a specific version like 16.0.19, or the string `latest` to get the latest release.
* `platform` - The target platform, e.g. `windows`, `linux`, `macos` or `android`. If not specified, the current device platform will be used.
* `arch` - The target architecture, e.g. `x86`, `x64`, or `arm64`. If not specified, the current device's architecture will be used.
* `ghToken` - A GitHub token to use when fetching the Frida release. If not specified, the value from the `GITHUB_TOKEN` environment variable will be used, if set. Downloads will usually work even if no token is available, but may hit GitHub rate limits especially if your IP is shared with other users (e.g. behind a corporate proxy).
* `sri` - An optional SRI hash which can be provided to guarantee the integrity of the downloaded binary. This should be the hash of the final extracted binary, not just the download body, in SRI format. To initially calculate the SRI, call `calculateFridaSRI` to pull a given version and hash the results. If `sri` is set, `version`, `platform` and `arch` must be fully specified or an error will be thrown.

It's technically possible to call this method from a browser, but you'd rarely want to - generally you want to call this from some kind of Node.js setup script.

### `FridaJS.calculateFridaSRI(options, hashOptions)`

Options:

* `version` - *Required* - The version of Frida server to download. This can be either a specific version like 16.0.19, or the string `latest` to get the latest release.
* `platform` - *Required* - The target platform, e.g. `windows`, `linux`, `macos` or `android`. If not specified, the current device platform will be used.
* `arch` - *Required* - The target architecture, e.g. `x86`, `x64`, or `arm64`. If not specified, the current device's architecture will be used.
* `ghToken` - A GitHub token to use when fetching the Frida release. If not specified, the value from the `GITHUB_TOKEN` environment variable will be used, if set. Downloads will usually work even if no token is available, but may hit GitHub rate limits especially if your IP is shared with other users (e.g. behind a corporate proxy).

Hash options:

* `algorithms` - An array of hash algorithms to use for hash calculation (defaults to `['sha512']`).

This pulls the specified Frida server version, and then calculates its hash. It returns an array of strings (one for each algorithm specified), any of which can be passed to `downloadFridaServer` as the `sri` argument.

This isn't retrieving the hash from some sort of guaranteed source - instead it's effectively a trust-on-first-download model. By using this, you're assuming that the hash you retrieve at this point is correct, so you should run this on a trusted computer & network wherever possible.

### `FridaJS.connect([options])`

Connects to a local Frida server, and returns a promise for a FridaClient.

Options must be an object containing the connection parameters. `host` is the only parameter currently supported, and must be set to the hostname and (optional) port string for the target Frida instance. If not set, it defaults to `127.0.0.1:27042`.

### `fridaClient.queryMetadata()`

Returns a promise for an object containing the exposed system parameters of the target Frida server. For example, on Linux this might look like:

```json
{
  "arch": "x64",
  "os": { "version": "22.10", "id": "ubuntu", "name": "Ubuntu" },
  "platform": "linux",
  "name": "your-system-hostname",
  "access": "full"
}
```

The exact parameters returned may vary and will depend on the specific target system.

### `fridaClient.enumerateProcesses()`

Returns a promise for an array of `{ pid: number, processName: string }` objects. You can use this to query the currently running processes that can be targeted from the target Frida server.

### `fridaClient.enumerateApplications()`

Returns a promise for an array of `{ pid: number | null, id: string, name: string }` objects. You can use this to query all installed applications (running or not) that can be targeted on a target mobile device.

The pid will be `null` if the app is not running, or a numeric process id otherwise. The id is the internal app identifier (e.g. Android package id) while the name is the user-visible application name.

This will always return an empty list on non-mobile devices.

### `fridaClient.injectIntoProcess(pid: number, script: string)`

Injects a given Frida script into a target process, specified by PID. Returns a promise that will resolve once the script has been successfully injected.

### `fridaClient.injectIntoNodeJSProcess(pid: number, script: string)`

Injects real JavaScript into Node.JS processes specifically. Rather than requiring a full Frida script, this takes any normal JS script, and conveniently wraps it with a script to inject it into the V8 event loop for you, so you can just write JS and run it in a target directly.

### `fridaClient.spawnWithScript(command: string, args: string[] | undefined, script: string)`

Takes a command to run and arguments, launches the process via Frida, injects the given Frida script before it starts, and then resumes the process.

Note that to launch apps on Android, `command` should be a package name like `com.android.dialer` and `args` must be undefined.

### `fridaClient.disconnect()`

When you're done, it's polite to disconnect from Frida. This returns a promise which resolves once the WebSocket connection has been closed.

## How does this work?

This library uses the WebSocket API [added in Frida v15.0](https://frida.re/news/2021/07/18/frida-15-0-released/#part-viii-the-web). This API exposes Frida's existing protocol via WebSocket connection, notably making it accessible to clients (such as browsers) whose network connectivity is limited and generally being a convenient widely supported base protocol for local & remote connections.

Once a WebSocket stream is connected, Frida can be controlled via the D-Bus protocol, sent over WebSocket connection. D-Bus is usually used as a protocol for IPC messaging in Linux desktop environments, but Frida uses it here for direct P2P connectivity over platform-specific transports (in this case, over WebSocket).

D-Bus takes a bit of getting used to, if you're not familiar with it, but is conveniently introspectable at runtime, and Frida's internals also explicitly define the various interfaces (e.g. [here](https://github.com/frida/frida-core/blob/main/lib/base/session.vala)) for the exposed services.

Using D-Bus from JavaScript is a little challenging, and normally requires native bindings to libdbus, which isn't practical in browser usage, and is inconvenient for cross-platform end-user deployments. One popular native JS library ([dbus-native](https://www.npmjs.com/package/dbus-native)) does exist but doesn't support P2P connections or various other facets of Frida's behaviour, so as part of this project a separate [@httptoolkit/dbus-native](https://github.com/httptoolkit/dbus-native) fork has been created, supporting all the various additional features required for Frida communication.

Once connected to D-Bus, the interfaces themselves are introspectable and the specific methods & signatures used by this project are explicitly listed in the code [here](https://github.com/httptoolkit/frida-js/blob/24552ab8676487995a37496581ee6bed6fe9d01a/src/index.ts#L36-L56). In general, the `HostSession` service provides the general purpose methods exposed by a Frida instance, such as launching processes or attaching to existing processes, while `AgentSession` is used for methods on an process once it has been launched, such as launching hook scripts to modify the target process.

All put together: this library connects via WebSocket, uses our dbus-native fork to negotiate a D-Bus session, calls HostSession methods to launch or attach to a target, and then calls AgentSession methods for the created target session to inject code directly into that process. All pure JS, all independent of platform, runtime & local/remote connectivity.

---

This library is part of [a broader HTTP Toolkit project](https://httptoolkit.com/blog/frida-mobile-interception-funding/), funded through the [NGI Zero Entrust Fund](https://nlnet.nl/entrust), established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more on the [NLnet project page](https://nlnet.nl/project/F3-AppInterception#ack).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0Entrust_tag.svg" alt="NGI Zero Entrust Logo" width="20%" />](https://nlnet.nl/entrust)
