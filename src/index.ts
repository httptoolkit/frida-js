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
    Resume(pid: number): Promise<void>;
    Kill(pid: number): Promise<void>;
}

interface AgentSession {
    CreateScript(script: string, options: {}): Promise<[number]>;
    LoadScript(scriptId: [number]): Promise<void>;
}

/**
 * A message from a Frida script to the runner.
 * https://github.com/frida/frida-core/blob/main/lib/base/session.vala#L124C2-L146C3
 * kind is the AgentMessageKind, "1" is a script message. There is also Debugger but no enum number is specified.
 * script_id is the script id that sent the message. It is part of the AgentScriptId type.
 * text is the message in plain text.
 * has_data is a boolean that indicates if there is data attached to the message.
 * data is the data attached to the message. It is a byte array.
 */
type AgentMessage = [kind: number, script_id: number[], text: string, has_data: boolean, data: Buffer | null]

/**
 * A message sent from a script to the agent.
 * https://github.com/frida/frida-node/blob/main/lib/script.ts#L103-L115
 */
export enum MessageType {
    Send = "send",
    Error = "error"
}

export type Message = ScriptAgentSendMessage | ScriptAgentErrorMessage;
export type ScriptAgentSendMessage = {
    type: MessageType.Send,
    payload: any
}
export type ScriptAgentErrorMessage = {
    type: MessageType.Error;
    description: string;
    stack?: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
}
enum AgentMessageKind {
    Script = 1,
    Debugger = 2,
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

    private async getAgentSession(sessionId: string, pid: number, hostSession: HostSession) {
        const agentSession = await this.bus
            .getService('re.frida.AgentSession16')
            .getInterface<AgentSession>('/re/frida/AgentSession/' + sessionId, 're.frida.AgentSession16');
        return new FridaAgentSession(this.bus, hostSession, pid, sessionId, agentSession);
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

    async attachToProcess(pid: number) {
        const hostSession = await this.getHostSession();

        const [sessionId] = await hostSession.Attach(pid, {});
        const agentSession = await this.getAgentSession(sessionId, pid, hostSession);

        return {
            session: agentSession
        };
    }

    /**
     * Attach to a given pid and inject a Frida script to manipulate the target program.
     *
     * Whether you can attach to the process may depend on system configuration. For
     * Linux specifically, if the process is not a child of your own process, you may
     * need to run `sudo sysctl kernel.yama.ptrace_scope=0` first.
     */
    async injectIntoProcess(pid: number, fridaScript: string) {
        const { session } = await this.attachToProcess(pid);

        const script = await session.createScript(fridaScript);

        setTimeout(async () => {
            try {
                await script.loadScript();
            } catch (e) {
                console.warn(e);
            }
        }, 0);

        return {
            session,
            script
        }
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

    async spawnPaused(command: string, args: string[] | undefined) {
        const hostSession = await this.getHostSession();

        const argOptions: [boolean, Array<string>] = args
            ? [true, [command, ...args]]
            : [false, []];

        const pid = await hostSession.Spawn(command, [
            ...argOptions,
            false, [],
            false, [],
            "",
            0,
            []
        ]);

        const [sessionId] = await hostSession.Attach(pid, {});
        const agentSession = await this.getAgentSession(sessionId, pid, hostSession);

        return {
            pid,
            session: agentSession
        }
    }

    async spawnWithScript(command: string, args: string[] | undefined, fridaScript: string) {
        const { session, pid } = await this.spawnPaused(command, args);

        const script = await session.createScript(fridaScript);
        setTimeout(async () => {
            try {
                await script.loadScript();
                await session.resume();
            } catch (e) {
                console.warn(e);
            }
        }, 0);

        return {
            pid,
            session,
            script
        }
    }
}

export class FridaAgentSession {
    constructor(
        private bus: dbus.DBusClient,
        private hostSession: HostSession,
        private pid: number,
        private sessionId: string,
        private agentSession: AgentSession,
    ) {}

    /**
     * This method sets up a message handler for messages sent from the agent.
     * @param cb Callback to be called when a message is received from the agent.
     */
    onMessage(cb: (message: Message) => void) {
        this.bus.setMethodCallHandler(`/re/frida/AgentMessageSink/${this.sessionId}`, "re.frida.AgentMessageSink16", "PostMessages", [(messages: AgentMessage[]) => {
            for(const message of messages) {
                const msg = JSON.parse(message[2]) as Message;
                switch(message[0]) { // message[0] is the message kind
                    case AgentMessageKind.Script:
                        cb(msg)
                        break;
                }
            }
        }, null]);
    }

    /**
     * Create a new Frida script within this agent session.
     * @param script The Frida script in plain text to create.
     * @param options Options to pass to the script.
     */
    async createScript(script: string, options: {} = {}): Promise<FridaScript> {
        const [scriptId] = await this.agentSession.CreateScript(script, options);
        return new FridaScript(this.bus, this.agentSession, [scriptId]);
    }

    resume() {
        return this.hostSession.Resume(this.pid);
    }

    kill() {
        return this.hostSession.Kill(this.pid);
    }
}

export class FridaScript {
    constructor(
        private bus: dbus.DBusClient,
        private agentSession: AgentSession,
        private scriptId: [number],
    ) {}

    /**
     * Load the script into the target process.
     * @returns Promise that resolves when the script is loaded.
     */
    async loadScript() {
        return this.agentSession.LoadScript(this.scriptId);
    }
}
