# Frida-JS [![Build Status](https://github.com/httptoolkit/frida-js/workflows/CI/badge.svg)](https://github.com/httptoolkit/frida-js/actions) [![Available on NPM](https://img.shields.io/npm/v/frida-js.svg)](https://npmjs.com/package/frida-js)

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

See the full API reference below for more details of the Frida APIs exposed, or see the test suite for a selection of working examples, and fixtures to test against.

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

It's technically possible to call this method from a browser, but you'd rarely want to - generally you want to call this from some kind of Node.js setup script.

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

Returns a promise for an array of `[pid: number, processName: string]` pairs. You can use this to query the currently running processes that can be targeted on your local machine.


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