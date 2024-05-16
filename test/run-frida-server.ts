import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

import { delay } from './test-util';

let fridaServer: ChildProcess | undefined;

export const FRIDA_SERVER_DIR = path.join(__dirname, '.frida-server');
export const FRIDA_SERVER_BIN = path.join(FRIDA_SERVER_DIR, 'frida-server');

const FRIDA_PORT = 27042;

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

    // Wait until the server is reachable:
    while (true) {
        const reachable = await new Promise<boolean>((resolve) => {
            const socket = net.createConnection({
                host: '127.0.0.1',
                port: FRIDA_PORT
            });
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('error', (e) => {
                resolve(false)
            });
        });

        if (reachable) break;
        else await delay(100);
    }

    return fridaServer;
}

export async function stopFridaServer() {
    if (!fridaServer) return;
    if (fridaServer.exitCode !== null) {
        console.log(`Frida already exited with ${fridaServer.exitCode}`);
        return;
    }

    const closePromise = new Promise((resolve) => {
        fridaServer!.on('close', resolve);
    });

    fridaServer.kill();

    const cleanExit = await Promise.race([
        closePromise.then(() => true),
        delay(500).then(() => false)
    ]);

    // Sometimes Frida doesn't seem to exit cleanly. Just kill it instead if need be:
    if (!cleanExit) {
        console.log('Frida did not exit cleanly - sending SIGKILL');
        fridaServer?.kill('SIGKILL');
        await closePromise;
    }
}