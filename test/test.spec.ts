import('./frida-test-setup');

import * as ChildProc from 'child_process';
import * as path from 'path';
import * as net from 'net';
import { expect } from 'chai';

import { fetch } from 'cross-fetch';

import { delay, isNode } from './test-util';
import { connect, FridaSession, ScriptAgentMessage } from '../src/index';

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
    })

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

        it("can get the send message from agent", async () => {
            // Start a demo subprocess to inject into:
            const childProc = ChildProc.spawn(
                // Fixture that loops until should_continue() returns false (which it never does).
                // Source is in fixtures-setup/rust-loop.
                path.join(__dirname, 'fixtures', `loop-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`),
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
            const expectedMessage = 'Hello from injected script!';
            fridaClient = await connect();
            const id = await fridaClient.injectIntoProcess(childProc.pid!, `
                setTimeout(() => {
                    send('${expectedMessage}');
                }, 1000);
            `);

            let message: ScriptAgentMessage = null!;
            fridaClient.listenToSession(id, (msg) => {
                message = msg;
            });

            await new Promise<void>((resolve, reject) => {
                const interval = setInterval(() => {
                    if (message) {
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error('Timed out waiting for message'));
                }, 5000);
            });

            // Inject into it:
            expect(message).to.not.be.null;
            expect(message.payload).to.equal(expectedMessage);
        });
    }

})