import('./frida-test-setup');

import * as ChildProc from 'child_process';
import * as path from 'path';
import * as net from 'net';
import { expect } from 'chai';

import { fetch } from 'cross-fetch';

import { delay, isNode } from './test-util';
import {
    connect,
    FridaSession,
    Message
} from '../src/index';

const FIXTURES_BASE = isNode
    ? path.join(__dirname, 'fixtures')
    : process.env.FIXTURES_PATH!;

describe("Frida-JS", () => {

    let fridaClient: FridaSession;

    let spawnedProc: ChildProc.ChildProcess | undefined;

    afterEach(async () => {
        await fridaClient?.disconnect();
        (fridaClient as any) = undefined;

        if (spawnedProc && spawnedProc.exitCode === null && !spawnedProc.killed) {
            try {
                console.log('Killing leftover test subprocess');
                spawnedProc.kill(9);
            } catch (e) {
                console.error(e);
            }
        }
        spawnedProc = undefined;
    });

    it("can connect to Frida and list target processes", async () => {
        fridaClient = await connect();
        const processes = await fridaClient.enumerateProcesses();

        expect(processes.length).to.be.greaterThan(0);

        if (isNode) {
            const thisProcess = processes.find(({ pid }) => pid === process.pid)!;
            expect(thisProcess.name).to.equal('node');
        }
    });

    it("can connect to Frida and list target apps", async () => {
        fridaClient = await connect();

        const processes = await fridaClient.enumerateApplications();

        // This should work, but won't actually return anything in local testing
        // because it's only applicable to mobile devices.
        expect(processes.length).to.equal(0);
    });

    it("can connect to a Frida instance by address", async () => {
        try {
            await connect({ host: '127.0.0.1:12345' });
            throw new Error('Should not connect successfully');
        } catch (e: any) {
            // This is expected. We can only check the error in Node though, as browsers
            // don't expose full network error details:
            if (isNode) {
                expect(e.message).to.include('ECONNREFUSED 127.0.0.1:12345');
            }
        }

        fridaClient = await connect({ host: '127.0.0.1:27042' });
        expect((await fridaClient.enumerateProcesses()).length).to.be.greaterThan(0);
    });

    it("can query Frida server metadata", async () => {
        fridaClient = await connect();
        const metadata = await fridaClient.queryMetadata();

        expect(metadata.access).to.equal('full');
        expect(metadata.arch).to.equal(process.arch);
        expect(metadata.platform).to.equal(process.platform);
    });

    it("can launch a process with a hook script injected", async function() {
        // Launch a server process with a script injected
        fridaClient = await connect();
        await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            ['original', 'arguments'],
            `
                const serveMessageFn = DebugSymbol.fromName('serve_message');

                const messageToInject = "INJECTED";
                const messagePtr = Memory.allocUtf8String(messageToInject);

                // Hook the serve_message function and replace the argument
                Interceptor.attach(ptr(serveMessageFn.address), {
                    onEnter(args) {
                        args[1] = messagePtr; // Arg 1 is pointer to string
                        args[2] = ptr(messageToInject.length.toString(16)) // Arg 2 is length
                        // (Note that Rust strings aren't null-terminated!)
                    }
                });
            `
        );

        await delay(100); // Wait momentarily for the server to start listening

        const resultingResponse = await fetch('http://127.0.0.1:3000');
        const resultingMessage = await resultingResponse.text();

        expect(resultingMessage).to.equal('INJECTED');
    });

    it("can get a message explicitly sent from the script", async () => {
        const expectedMessage = 'Hello from injected script!';

        // Start a demo subprocess to inject into:
        fridaClient = await connect();
        const { session } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            `
                setTimeout(() => {
                    send('${expectedMessage}');
                }, 100);
            `
        );

        let message = await new Promise<Message | null>((resolve, reject) => {
            session.onMessage(resolve);
            setTimeout(() => {
                reject(new Error('Timed out waiting for message'));
            }, 1000);
        });

        await fetch('http://127.0.0.1:3000'); // Fetch triggers shutdown

        expect(message).to.deep.equal({
            type: 'send',
            payload: expectedMessage
        });
    });

    it("can get a message console logged from a script", async () => {
        const expectedMessage = 'Logged warning message!';

        // Start a demo subprocess to inject into:
        fridaClient = await connect();
        const { session } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            `
                setTimeout(() => {
                    console.warn('${expectedMessage}');
                }, 100);
            `
        );

        let message = await new Promise<Message | null>((resolve, reject) => {
            session.onMessage(resolve);
            setTimeout(() => {
                reject(new Error('Timed out waiting for message'));
            }, 1000);
        });

        await fetch('http://127.0.0.1:3000'); // Fetch triggers shutdown

        expect(message).to.deep.equal({
            type: 'log',
            level: 'warning',
            payload: expectedMessage
        });
    });

    it("can receive script errors from a launched process", async () => {
        // Launch a server process with a failing script injected
        fridaClient = await connect();
        const { session } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            // Run an example script that always crashes:
            "throw new Error('Intentional script failure error');"
        );
        const messages: Message[] = [];
        session.onMessage((msg) => messages.push(msg));

        await delay(100); // Wait momentarily for the server to start listening

        const resultingResponse = await fetch('http://127.0.0.1:3000');
        expect(resultingResponse.status).to.equal(200);

        expect(messages).to.deep.equal([{
            type: 'error',
            description: 'Error: Intentional script failure error',
            stack: 'Error: Intentional script failure error\n' +
            '    at <eval> (/script1.js:1)',
            fileName: '/script1.js',
            lineNumber: 1,
            columnNumber: 1
        }]);
    });

    it("can send a simple message to the script", async () => {
        const pingPayload = 'ping';
        const pongPayload = 'pong';

        fridaClient = await connect();
        const { session, script } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            `
                recv(m => {
                    if (m === '${pingPayload}') {
                        send('${pongPayload}');
                    }
                });
            `,
        );

        await delay(100); // Wait momentarily for the script to load and for the server to start listening

        const messagePromise = new Promise<Message | null>((resolve, reject) => {
            session.onMessage(resolve);
            setTimeout(() => {
                reject(new Error('Timed out waiting for message'));
            }, 1000);
        });
        await script.post(pingPayload);
        const message = await messagePromise;

        await fetch('http://127.0.0.1:3000'); // Fetch triggers shutdown

        expect(message).to.deep.equal({
            type: 'send',
            payload: pongPayload
        });
    });

    it("can send a typed message to the script", async () => {
        const messageType = 123;
        const pingPayload = 'ping';
        const pongPayload = 'pong';

        fridaClient = await connect();
        const { session, script } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            `
                recv(${messageType}, m => {
                    if (m.msg === '${pingPayload}') {
                        send('${pongPayload}')
                    }
                })
            `,
        );

        await delay(100); // Wait momentarily for the script to load and for the server to start listening

        const messagePromise = new Promise<Message | null>((resolve, reject) => {
            session.onMessage(resolve);
            setTimeout(() => {
                reject(new Error('Timed out waiting for message'));
            }, 1000);
        });
        await script.post({type: messageType, msg: pingPayload});
        const message = await messagePromise;

        await fetch('http://127.0.0.1:3000'); // Fetch triggers shutdown

        expect(message).to.deep.equal({
            type: 'send',
            payload: pongPayload
        });
    });

    it("can send binary data to the script", async () => {
        const binaryData = [0x62, 0x75, 0x66, 0x66, 0x65, 0x72]; // "buffer"
        const okPayload = 'ok';

        fridaClient = await connect();
        const { session, script } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            `
                const expectedLength = ${binaryData.length};
                const expectedBytes = JSON.parse('${JSON.stringify(binaryData)}');
                recv((_, binaryData) => {
                    if (binaryData.byteLength !== expectedLength) {
                        send('wrong byteLength: ' + binaryData.byteLength + ' !== ' + expectedLength);
                        return;
                    }
                    const byteArray = new Uint8Array(binaryData);
                    const wrongValueIdx = expectedBytes.findIndex((expectedValue, idx) => byteArray[idx] !== expectedValue);
                    if (wrongValueIdx === -1) {
                        send('${okPayload}');
                    } else {
                        send('wrong value at index ' + wrongValueIdx + ': ' + byteArray[wrongValueIdx] + ' !== ' + expectedBytes[wrongValueIdx]);
                    }
                })
            `,
        );

        await delay(100); // Wait momentarily for the script to load and for the server to start listening

        const messagePromise = new Promise<Message | null>((resolve, reject) => {
            session.onMessage(resolve);
            setTimeout(() => {
                reject(new Error('Timed out waiting for message'));
            }, 1000);
        });
        await script.post('', Buffer.from(binaryData));
        const message = await messagePromise;

        await fetch('http://127.0.0.1:3000'); // Fetch triggers shutdown

        expect(message).to.deep.equal({
            type: 'send',
            payload: okPayload
        });
    });

    it("can send multiple messages to the script", async () => {
        const messagePayloads = ['A', 'B', 'C'];
        const expectedMessages = messagePayloads.map(payload => ({type: 'send', payload}));

        fridaClient = await connect();
        const { session, script } = await fridaClient.spawnWithScript(
            path.join(FIXTURES_BASE, `serve-${process.platform}-${process.arch}`),
            [],
            `
                const msgHandler = m => {
                    send(m);
                    recv(msgHandler);
                };
                recv(msgHandler);
            `,
        );

        await delay(100); // Wait momentarily for the script to load and for the server to start listening

        const receivedMessagesPromise = new Promise<Message[]>((resolve, reject) => {
            const receivedPayloads: Message[] = [];
            session.onMessage((msg) => {
                if (receivedPayloads.push(msg) === messagePayloads.length) {
                    resolve(receivedPayloads);
                }
            });
            setTimeout(() => {
                reject(new Error('Timed out waiting for messages'));
            }, 1000);
        });

        for (const payload of messagePayloads) {
            await script.post(payload);
        }

        const receivedMessages = await receivedMessagesPromise;

        await fetch('http://127.0.0.1:3000'); // Fetch triggers shutdown

        expect(receivedMessages).to.deep.equal(expectedMessages);
    });

    if (isNode) {
        it("can connect to a Frida instance by raw stream", async () => {
            const socket = net.createConnection({
                host: '127.0.0.1',
                port: 27042
            });

            await new Promise((resolve, reject) => {
                socket.on('connect', resolve);
                socket.on('error', reject);
            });

            fridaClient = await connect({ stream: socket, host: 'localhost:12345' as any });
            expect((await fridaClient.enumerateProcesses()).length).to.be.greaterThan(0);
        });

        it("can inject into a target process", async () => {
            // Start a demo subprocess to inject into:
            const childProc = ChildProc.spawn(
                // Fixture that loops until should_continue() returns false (which it never does).
                // Source is in fixtures-setup/rust-loop.
                path.join(__dirname, 'fixtures', `loop-${process.platform}-${process.arch}`),
                { stdio: 'pipe' }
            );
            childProc.unref();
            spawnedProc = childProc; // Ensure this is killed after testing

            const outputPromise = new Promise<{
                exitCode: number | null,
                output: string
            }>((resolve, reject) => {
                let output = '';
                childProc.stdout.on('data', (msg) => output += msg.toString());
                childProc.stderr.on('data', (msg) => output += msg.toString());
                childProc.stdout.pipe(process.stdout);
                childProc.stderr.pipe(process.stderr);
                childProc.on('close', (exitCode) => resolve({ exitCode, output }));
                childProc.on('error', reject);
            });

            // Wait for the target to start up:
            await new Promise((resolve, reject) => {
                childProc.on('spawn', resolve);
                childProc.on('error', reject);
            });

            // Inject into it:
            fridaClient = await connect();
            await fridaClient.injectIntoProcess(childProc.pid!, `
                const shouldContinue = DebugSymbol.fromName('should_continue');

                // Hook the should_continue function
                Interceptor.attach(ptr(shouldContinue.address), {
                    onLeave(retval) {
                        console.log('Overriding should_continue()');
                        // Allocate a false bool:
                        const mem = Memory.alloc(1);
                        mem.writeU8(0);
                        // Set the return value of should_continue to false
                        retval.replace(mem);
                    }
                });
            `);

            const { exitCode, output } = await outputPromise;

            expect(exitCode).to.equal(0);
            expect(output.slice(-13)).to.equal('Running\nDone\n');
        });

        it("can inject into a target node process", async function () {
            this.timeout(5000);

            // Start a Node subprocess to inject into:
            const childNodeProc = ChildProc.spawn(
                process.execPath,
                // Run node silently for 1 second, then exit unhappily:
                ['-e', 'setTimeout(() => { process.exit(1); }, 1000)'],
                { stdio: 'pipe' }
            );
            childNodeProc.unref();
            spawnedProc = childNodeProc; // Ensure this is killed after testing

            const outputPromise = new Promise<{
                exitCode: number | null,
                output: string
            }>((resolve, reject) => {
                let output = '';
                childNodeProc.stdout.on('data', (msg) => output += msg.toString());
                childNodeProc.stderr.on('data', (msg) => output += msg.toString());
                childNodeProc.on('close', (exitCode) => resolve({ exitCode, output }));
                childNodeProc.on('error', reject);
            });

            // Wait for the target to start up:
            await new Promise((resolve, reject) => {
                childNodeProc.on('spawn', resolve);
                childNodeProc.on('error', reject);
            });
            await delay(10); // Give the process time to start

            // Inject into it:
            fridaClient = await connect();
            await fridaClient.injectIntoNodeJSProcess(
                childNodeProc.pid!,
                'console.log("Hello from injected script!"); process.exit(0);'
            );

            const { exitCode, output } = await outputPromise;

            expect(exitCode).to.equal(0);
            expect(output).to.equal('Hello from injected script!\n');
        });

        it("can kill a target process", async () => {
            // Start a demo subprocess to kill:
            const childProc = ChildProc.spawn(
                // Fixture that loops until should_continue() returns false (which it never does).
                // Source is in fixtures-setup/rust-loop.
                path.join(__dirname, 'fixtures', `loop-${process.platform}-${process.arch}`),
                { stdio: 'pipe' }
            );
            childProc.unref();
            spawnedProc = childProc; // Ensure this is killed after testing

            const outputPromise = new Promise<{
                exitCode: number | null,
                signal: NodeJS.Signals | null
            }>((resolve, reject) => {
                childProc.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
                childProc.on('error', reject);
            });

            // Wait for the target to start up:
            await new Promise((resolve, reject) => {
                childProc.on('spawn', resolve);
                childProc.on('error', reject);
            });

            fridaClient = await connect();
            const { session } = await fridaClient.attachToProcess(childProc.pid!);

            // Without this, the loop process will run forever
            await session.kill();

            const { exitCode, signal } = await outputPromise;

            expect(exitCode).to.equal(null);
            expect(signal).to.equal("SIGKILL");
        });
    }

})