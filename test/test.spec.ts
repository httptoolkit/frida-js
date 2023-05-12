import('./frida-test-setup');

import * as childProc from 'child_process';
import { expect } from 'chai';

import { isNode } from './test-util';
import { connect } from '../src/index';

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
            // Start a Node subprocess to inject into:
            const childNodeProc = childProc.spawn(
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
            await fridaClient.injectIntoNodeJsProcess(
                childNodeProc.pid!,
                'console.log("Hello from injected script!"); process.exit(0);'
            );

            const { exitCode, output } = await outputPromise;

            expect(exitCode).to.equal(0);
            expect(output).to.equal('Hello from injected script!\n');
        });
    }

})