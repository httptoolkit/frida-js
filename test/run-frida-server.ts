import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

let fridaServer: ChildProcess | undefined;

export const FRIDA_SERVER_DIR = path.join(__dirname, '.frida-server');
export const FRIDA_SERVER_BIN = path.join(FRIDA_SERVER_DIR, 'frida-server');

export async function startFridaServer() {
    if (fridaServer) throw new Error("Can't start Frida server when one is already running");

    fridaServer = spawn(FRIDA_SERVER_BIN, { stdio: 'inherit' });

    fridaServer.on('close', (code) => {
        if (code !== 0 && code !== null) {
            throw new Error(`Frida exited unexpectedly with code ${code}`);
        }

        fridaServer = undefined;
    });

    await new Promise((resolve) => {
        fridaServer!.on('spawn', resolve);
    });

    return fridaServer;
}

export async function stopFridaServer() {
    if (!fridaServer) return;
    fridaServer.kill();

    return new Promise((resolve) => {
        fridaServer?.on('close', resolve);
    });
}