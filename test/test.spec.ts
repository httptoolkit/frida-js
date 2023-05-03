import { expect } from 'chai';
import { x } from '../src/index';

describe("Test", () => {
    it("passes", () => {
        expect(x).to.equal('test');
    });
})