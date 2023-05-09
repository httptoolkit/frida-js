import WebSocket = require('isomorphic-ws');
import createWebSocketStream = require('@httptoolkit/websocket-stream');
import dbus = require('@httptoolkit/dbus-native');

const FRIDA_PORT = 27042;

export async function connect() {
    const socket = new WebSocket(`ws://localhost:${FRIDA_PORT}/ws`);
    socket.binaryType = 'arraybuffer';

    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve);
        socket.addEventListener('error', reject);
    });

    const bus = dbus.createClient({
        stream: createWebSocketStream(socket),
        direct: true,
        authMethods: []
    });

    return new FridaSession(bus);
}

interface HostSession {
    EnumerateProcesses(arg: {}): Promise<Array<[number, string]>>;
}

class FridaSession {

    constructor(private bus: dbus.DBusClient) {
    }

    async enumerateProcesses() {
        const hostSession = await this.bus
            .getService('re.frida.HostSession16')
            .getInterface<HostSession>('/re/frida/HostSession', 're.frida.HostSession16');

        return hostSession.EnumerateProcesses({});
    }

}