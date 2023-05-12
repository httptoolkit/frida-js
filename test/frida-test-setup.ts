import { delay, isNode } from './test-util';

if (isNode) {
    const { startFridaServer, stopFridaServer } = require("./run-frida-server") as typeof import('./run-frida-server');

    before(() => startFridaServer());
    after(() => stopFridaServer());
} else {
    before(async () => {
        // Wait just a moment to give Frida (started via package.json script) time to start up.
        await delay(500);
    });
}