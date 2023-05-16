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
    Attach(pid: number, options: {}): Promise<[string]>;
}

interface AgentSession {
    CreateScript(script: string, options: {}): Promise<[number]>;
    LoadScript(scriptId: [number]): Promise<void>;
}

class FridaSession {

    constructor(
        private bus: dbus.DBusClient
    ) {}

    private getHostSession() {
        return this.bus
        .getService('re.frida.HostSession16')
        .getInterface<HostSession>('/re/frida/HostSession', 're.frida.HostSession16');
    }

    private getAgentSession(sessionId: string) {
        return this.bus
            .getService('re.frida.AgentSession16')
            .getInterface<AgentSession>('/re/frida/AgentSession/' + sessionId, 're.frida.AgentSession16');
    }

    async enumerateProcesses() {
        const hostSession = await this.getHostSession();
        return hostSession.EnumerateProcesses({});
    }

    /**
     * Attach to a given pid and inject a Frida script to manipulate the target program.
     *
     * Whether you can attach to the process may depend on system configuration. For
     * Linux specifically, if the process is not a child of your own process, you may
     * need to run `sudo sysctl kernel.yama.ptrace_scope=0` first.
     */
    async injectIntoProcess(pid: number, fridaScript: string) {
        const hostSession = await this.getHostSession();

        const [sessionId] = await hostSession.Attach(pid, {});
        const agentSession = await this.getAgentSession(sessionId);

        const scriptId = await agentSession.CreateScript(fridaScript, {});
        await agentSession.LoadScript(scriptId);
    }

    /**
     * Run arbitrary Node.js code directly within a target Node process. The given
     * code string will be wrapped with a Frida hook that injects it directly into
     * the event loop, so it will run immediately.
     */
    async injectIntoNodeJsProcess(pid: number, nodeScript: string) {
        const fridaScript = require('../scripts/node-js-inject.js')
            .buildNodeJsInjectionScript(nodeScript);

        return this.injectIntoProcess(pid, fridaScript);
    }

}