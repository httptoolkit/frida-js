import * as fs from 'fs';

import { expect } from 'chai';
import * as tmp from 'tmp-promise';

import { isNode } from './test-util';
import { downloadFridaServer, calculateFridaSRI } from '../src/index';

if (isNode) {
    describe("Downloading Frida with Frida-JS", function () {
        this.timeout(30000); // Can be slow, since we're doing MB downloads & disk IO

        let tmpFile: tmp.FileResult;

        beforeEach(async () => {
            tmpFile = await tmp.file();
        });

        afterEach(() => tmpFile?.cleanup());

        it("can download a Frida server automatically", async () => {
            const fridaServerStream = await downloadFridaServer({ version: 'latest' });

            const writeStream = fridaServerStream.pipe(
                fs.createWriteStream(tmpFile.path)
            );

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            const fileStat = await fs.promises.stat(tmpFile.path);
            expect(fileStat.size).to.be.greaterThan(1_000_000); // All servers are 4MB+
            // We don't test full Frida functionality - that's covered by the other
            // tests that pull Frida via download-test-frida anyway.
        });

        it("can calculate an SRI hash for a Frida download", async () => {
            const sri = await calculateFridaSRI({
                version: '16.1.3',
                arch: 'x86_64',
                platform: 'linux'
            });

            expect(sri).to.deep.equal([
                'sha512-ccWUJdrpRWSbar18dvC9WmhelqKn5/iWA+nru0KcamuGKCtxq+tEtcBcM+tnnFzIw8Bz4psnJjJ4u8ZVqISQyw=='
            ]);
        });

        it("rejects downloads that don't match the provided hash", async () => {
            const fridaServerStream = await downloadFridaServer({
                version: '16.1.3',
                arch: 'x86_64',
                platform: 'linux',

                sri: 'sha256-abcdefabcdefabcdefabcdef'
            });

            setImmediate(() => fridaServerStream.resume());
            const streamResult: any = await new Promise((resolve, reject) => {
                fridaServerStream.on('end', () => reject(new Error('Stream unexpectedly ended OK')));
                fridaServerStream.on('error', resolve);
            });

            // Should be an error, explicitly rejecting the checksum and returning the correct one:
            expect(streamResult).to.be.instanceOf(Error);
            expect(streamResult.message).to.include(
                'sha256-abcdefabcdefabcdefabcdef integrity checksum failed'
            );
            expect(streamResult.message).to.include(
                'sha512-ccWUJdrpRWSbar18dvC9WmhelqKn5/iWA+nru0KcamuGKCtxq+tEtcBcM+tnnFzIw8Bz4psnJjJ4u8ZVqISQyw=='
            );
        });

        it("accepts downloads that do match the provided hash", async () => {
            const fridaServerStream = await downloadFridaServer({
                version: '16.1.3',
                arch: 'x86_64',
                platform: 'linux',

                sri: 'sha512-ccWUJdrpRWSbar18dvC9WmhelqKn5/iWA+nru0KcamuGKCtxq+tEtcBcM+tnnFzIw8Bz4psnJjJ4u8ZVqISQyw=='
            });

            const writeStream = fridaServerStream.pipe(
                fs.createWriteStream(tmpFile.path)
            );

            const streamResult: any = await new Promise((resolve, reject) => {
                fridaServerStream.on('error', reject);
                writeStream.on('error', reject);
                writeStream.on('finish', resolve);
            });

            // Stream should complete without errors:
            expect(streamResult).to.equal(undefined);

            // Stream should actually write the server bin, in addition to SRI checks:
            const fileStat = await fs.promises.stat(tmpFile.path);
            expect(fileStat.size).to.be.greaterThan(1_000_000); // All servers are 4MB+
        });

    });
}