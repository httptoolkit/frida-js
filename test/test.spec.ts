import('./test-util');

import { connect } from '../src/index';

describe("Test", () => {
    it("can connect to Frida", async () => {
        await connect();
    });
})