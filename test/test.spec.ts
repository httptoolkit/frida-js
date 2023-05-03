import { expect } from 'chai';

import('./test-util');
import { x } from '../src/index';

describe("Test", () => {
    it("passes", () => {
        expect(x).to.equal('test');
    });
})