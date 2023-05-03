const WebSocket = globalThis.WebSocket ?? require('ws');
const FRIDA_PORT = 27042;

export async function connect() {
    const socket = new WebSocket(`ws://localhost:${FRIDA_PORT}/ws`);

    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve);
        socket.addEventListener('error', reject);
    });
}