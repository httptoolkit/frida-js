import('./test-util');

import { expect } from 'chai';

import { connect } from '../src/index';

describe("Test", () => {
    it("can connect to Frida", async () => {
        const fridaClient = await connect();
        const processes = await fridaClient.enumerateProcesses();
        expect(processes.length).to.be.greaterThan(0);
    });
})