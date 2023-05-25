# Frida-JS [![Build Status](https://github.com/httptoolkit/frida-js/workflows/CI/badge.svg)](https://github.com/httptoolkit/frida-js/actions) [![Available on NPM](https://img.shields.io/npm/v/frida-js.svg)](https://npmjs.com/package/frida-js)

> _Part of [HTTP Toolkit](https://httptoolkit.com): powerful tools for building, testing & debugging HTTP(S)_

Pure-JS bindings to control Frida from node.js &amp; browsers.

This module provides access to Frida, without bundling Frida itself. That means no native binaries included, no compilation required, and no heavyweight files (the entire library is under 10KB). This works by making WebSocket connections (supported in Frida v15+) directly to an existing Frida instance elsewhere.

This is particularly useful in mobile device scenarios, as you can now run Frida purely on the device (as an Android/iOS Frida server instance, or using Frida-Gadget embedded in a specific application) and connect to it through using this library as a tiny client in Node.js or a browser elsewhere.

## Getting Started

```bash
npm install frida-js
```

First, you'll need a Frida instance to connect to. For now Frida-JS supports local Frida servers only, but remote device support is coming imminently.

If you don't have this already, you'll want to download, extract & run the `frida-server` release for your platform from https://github.com/frida/frida/releases/latest. In future Frida-JS will provide an API to do this automatically on demand.

To use Frida-JS, first call the exported `connect()` method and wait for the returned promise to get a FridaClient, and then call the methods there to query the available targets and hook them (full API listing below). For example:

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

### `FridaJS.connect()`

Connects to a local Frida server, and returns a promise for a FridaClient.

### `FridaClient.enumateProcesses()`

Returns a promise for an array of `[pid: number, processName: string]` pairs. You can use this to query the currently running processes that can be targeted on your local machine.


### `FridaClient.injectIntoProcess(pid: number, script: string)`

Injects a given Frida script into a target process, specified by PID. Returns a promise that will resolve once the script has been successfully injected.

### `FridaClient.injectIntoNodeJSProcess(pid: number, script: string)`

Injects real JavaScript into Node.JS processes specifically. Rather than requiring a full Frida script, this takes any normal JS script, and conveniently wraps it with a script to inject it into the V8 event loop for you, so you can just write JS and run it in a target directly.

### `FridaClient.spawnWithScript(command: string, args: string[], script: string)`

Takes a command to run and arguments, launches the process via Frida, injects the given Frida script before it starts, and then resumes the process.