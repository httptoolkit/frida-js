import('./frida-test-setup');

import * as ChildProc from 'child_process';
import * as path from 'path';
import { expect } from 'chai';

import { fetch } from 'cross-fetch';

import { delay, isNode } from './test-util';
import { connect } from '../src/index';

const FIXTURES_BASE = isNode
    ? path.join(__dirname, 'fixtures')
    : process.env.FIXTURES_PATH!;

describe("Frida-JS", () => {

    it("can connect to Frida and list targets", async () => {
        const fridaClient = await connect();
        const processes = await fridaClient.enumerateProcesses();

        expect(processes.length).to.be.greaterThan(0);

        if (isNode) {
            const thisProcess = processes.find(([pid]) => pid === process.pid)!;
            expect(thisProcess[1]).to.equal('node');
        }
    });

    if (isNode) {
        it("can inject into a target process", async () => {
            // Start a demo subprocess to inject into:
            const childProc = ChildProc.spawn(
                // Fixture that loops until should_continue() returns false (which it never does).
                // Source is in fixtures-setup/rust-loop.
                path.join(__dirname, 'fixtures', `loop-${process.platform}-${process.arch}`),
                { stdio: 'pipe' }
            );
            childProc.unref();

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
            const fridaClient = await connect();
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

        it("can inject into a target node process", async () => {
            // Start a Node subprocess to inject into:
            const childNodeProc = ChildProc.spawn(
                process.execPath,
                // Run node silently for 1 second, then exit unhappily:
                ['-e', 'setTimeout(() => { process.exit(1); }, 1000)'],
                { stdio: 'pipe' }
            );
            childNodeProc.unref();

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

            // Inject into it:
            const fridaClient = await connect();
            await fridaClient.injectIntoNodeJSProcess(
                childNodeProc.pid!,
                'console.log("Hello from injected script!"); process.exit(0);'
            );

            const { exitCode, output } = await outputPromise;

            expect(exitCode).to.equal(0);
            expect(output).to.equal('Hello from injected script!\n');
        });
    }

    it("can launch a process with a hook script injected", async function() {
        // Launch a server process with a script injected
        const fridaClient = await connect();
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

        const resultingResponse = await fetch('http://localhost:3000');
        const resultingMessage = await resultingResponse.text();

        expect(resultingMessage).to.equal('INJECTED');
    });

})