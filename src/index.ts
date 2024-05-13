import type * as stream from 'stream';
import WebSocket = require('isomorphic-ws');
import createWebSocketStream = require('@httptoolkit/websocket-stream');
import dbus = require('@httptoolkit/dbus-native');

import { DBusVariantDict, NestedStringDict, parseDBusVariantDict } from './dbus-value';

export {
    getFridaReleaseDetails,
    calculateFridaSRI,
    downloadFridaServer
} from './download-frida';

const DEFAULT_FRIDA_PORT = 27042;


const connectFridaWebSocket = async (fridaHost: string, options?: {
    createConnection?: () => stream.Duplex
}) => {
    const socket = new WebSocket(`ws://${fridaHost}/ws`, options);
    socket.binaryType = 'arraybuffer';

    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve);
        socket.addEventListener('error', reject);
    });

    return socket;
}

export async function connect(options:
    | { host?: string, stream?: undefined }
    // Note that providing a stream directly is supported on Node only
    | { stream?: stream.Duplex, host?: undefined }= {}
) {
    const fridaHost = options.host || `127.0.0.1:${DEFAULT_FRIDA_PORT}`;

    const webSocket = options.stream
        ? await connectFridaWebSocket(fridaHost, {
            createConnection: () => options.stream!
        })
        : await connectFridaWebSocket(fridaHost);

    const bus = dbus.createClient({
        stream: createWebSocketStream(webSocket),
        direct: true,
        authMethods: []
    });

    // bus.self.connection.on("message", console.log);

    // bus.signals.on("message", console.log);

    return new FridaSession(bus);
}

interface HostSession {
    QuerySystemParameters(): Promise<DBusVariantDict>;
    EnumerateProcesses(arg: {}): Promise<Array<[pid: number, name: string]>>;
    EnumerateApplications(arg: {}): Promise<Array<[id: string, name: string, pid: number | 0]>>;
    Attach(pid: number, options: {}): Promise<[string]>;
    Spawn(program: string, options: [
        hasArgv: boolean,
        argv: string[],
        hasEnvP: boolean,
        envp: string[],
        hasEnv: boolean,
        env: string[],
        cwd: string,
        stdio: number,
        aux: []
    ]): Promise<number>;
}

interface AgentSession {
    CreateScript(script: string, options: {}): Promise<[number]>;
    LoadScript(scriptId: [number]): Promise<void>;
}

type AgentMessage = [number, number[], json: string, has_data: boolean, data: Buffer | null]
export type ScriptAgentMessage = {
    type: "send",
    payload: any
}

export class FridaSession {

    constructor(
        private bus: dbus.DBusClient
    ) {}

    /**
     * Disconnect from Frida. Returns a promise that resolves once the connection has been closed.
     */
    async disconnect() {
        return this.bus.disconnect();
    }

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

    private listenToAgentMessages(sessionId: string, cb: (message: ScriptAgentMessage) => void){
        this.bus.setMethodCallHandler(`/re/frida/AgentMessageSink/${sessionId}`, "re.frida.AgentMessageSink16", "PostMessages", [(messages: AgentMessage[]) => {
            for(const message of messages) { // ScriptMessage 
                if(message[0] === 1) {
                    return cb(JSON.parse(message[2]));
                }
            }
        }, null]);
    }

    /**
     * Query the system parameters of the target Frida server. Returns metadata
     * as a nested dictionary of strings.
     */
    async queryMetadata(): Promise<NestedStringDict> {
        const hostSession = await this.getHostSession();
        const rawMetadata = await hostSession.QuerySystemParameters();
        return parseDBusVariantDict(rawMetadata);
    }

    /**
     * List all running processes accessible to the target Frida server. Returns an array
     * of { pid, name } objects.
     */
    async enumerateProcesses(): Promise<Array<{
        pid: number,
        name: string
    }>> {
        const hostSession = await this.getHostSession();
        return (await hostSession.EnumerateProcesses({})).map((proc) => ({
            pid: proc[0],
            name: proc[1]
        }));
    }

    /**
     * List all installed applications accessible on the target Frida server. Returns an array of
     * { pid, id, name } objects, where pid is null if the application is not currently running.
     *
     * This is only applicable to mobile devices, and will return an empty array everywhere else.
     */
    async enumerateApplications(): Promise<Array<{
        pid: number | null,
        id: string,
        name: string
    }>> {
        const hostSession = await this.getHostSession();
        return (await hostSession.EnumerateApplications({})).map((proc) => ({
            pid: proc[2] || null, // Not running = 0. We map it to null.
            id: proc[0],
            name: proc[1]
        }));
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

        return sessionId;
    }

    /**
     * Run arbitrary Node.js code directly within a target Node process. The given
     * code string will be wrapped with a Frida hook that injects it directly into
     * the event loop, so it will run immediately.
     */
    async injectIntoNodeJSProcess(pid: number, nodeScript: string) {
        const fridaScript = require('../scripts/node-js-inject.js')
            .buildNodeJsInjectionScript(nodeScript);

        return this.injectIntoProcess(pid, fridaScript);
    }

    async spawnWithScript(command: string, args: string[] | undefined, fridaScript: string) {
        const hostSession: any = await this.getHostSession();

        const pid = await hostSession.Spawn(command, [
            ...(args
                ? [true, [command, ...args]]
                : [false, []]),
            false, [],
            false, [],
            "",
            0,
            []
        ]);

        const [sessionId] = await hostSession.Attach(pid, {});
        const agentSession = await this.getAgentSession(sessionId);

        const scriptId = await agentSession.CreateScript(fridaScript, {});
        await agentSession.LoadScript(scriptId);

        await hostSession.Resume(pid);
    }

    async listenToSession(id: string, cb: (message: ScriptAgentMessage) => void) {
        this.listenToAgentMessages(id, cb);
    }
}
