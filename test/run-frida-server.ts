import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { delay } from './test-util';

let fridaServer: ChildProcess | undefined;

export const FRIDA_SERVER_DIR = path.join(__dirname, '.frida-server');
export const FRIDA_SERVER_BIN = path.join(FRIDA_SERVER_DIR, 'frida-server');

export async function startFridaServer() {
    if (fridaServer) throw new Error("Can't start Frida server when one is already running");

    fridaServer = spawn(FRIDA_SERVER_BIN, { stdio: 'inherit' });
    fridaServer.unref();

    fridaServer.on('close', (code) => {
        if (code !== 0 && code !== null) {
            throw new Error(`Frida exited unexpectedly with code ${code}`);
        }
        fridaServer = undefined;
    });

    await new Promise((resolve) => {
        fridaServer!.on('spawn', resolve);
    });

    // Add a little delay just to make sure the server is definitely started & ready
    await delay(500);

    return fridaServer;
}

export async function stopFridaServer() {
    if (!fridaServer) return;
    if (fridaServer.exitCode !== null) return;

    const exitPromise = new Promise((resolve) => {
        fridaServer!.on('exit', resolve);
    });

    fridaServer.kill();

    await Promise.race([
        exitPromise,
        // Sometimes Frida doesn't seem to exit cleanly. Just kill it instead if need be:
        delay(500).then(() => fridaServer?.kill('SIGKILL'))
    ]);
}