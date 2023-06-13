import * as path from 'path';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

import * as semver from 'semver';

import {
    FRIDA_SERVER_DIR,
    FRIDA_SERVER_BIN
} from './run-frida-server';

import {
    getFridaReleaseDetails,
    downloadFridaServer
} from '../src/index';

const canAccess = (path: string) => fs.access(path).then(() => true).catch(() => false);

const FRIDA_DOWNLOAD_METADATA = path.join(FRIDA_SERVER_DIR, 'metadata.json');

async function setUpLocalEnv() {
    const serverExists = await canAccess(FRIDA_DOWNLOAD_METADATA);
    const currentServerVersion = serverExists
        ? require(FRIDA_DOWNLOAD_METADATA).version
        : null;

    try {
        const latestServerDetails = await getFridaReleaseDetails('latest', process.env.GITHUB_TOKEN);
        const latestServerVersion: string = latestServerDetails.tag_name;

        if (!serverExists || semver.gt(latestServerVersion, currentServerVersion)) {
            // Remove any existing binary:
            await fs.unlink(FRIDA_SERVER_BIN).catch((e: any) => {
                if (e.code === 'ENOENT') return;
                else throw e;
            });

            await fs.mkdir(FRIDA_SERVER_DIR, { recursive: true });

            const fridaStream = await downloadFridaServer({ version: latestServerVersion });
            await pipeline(fridaStream, createWriteStream(FRIDA_SERVER_BIN));

            await Promise.all([
                // Make the bin executable
                fs.chmod(FRIDA_SERVER_BIN, 0o755),
                // Update metadata, recording which version we downloaded
                fs.writeFile(FRIDA_DOWNLOAD_METADATA, JSON.stringify({
                    version: latestServerDetails.tag_name
                }))
            ]);

            console.log('Server setup completed.');
        } else {
            console.log('Downloaded server already up to date.');
        }
    } catch (e: any) {
        if (serverExists) {
            // If we can ignore this, do - let's just use what we've got
            console.log(`Failed to fetch latest Frida server due to '${e.message}' - using existing for now`);
            return true;
        } else {
            throw e;
        }
    }
}

setUpLocalEnv().catch(e => {
    console.error(e);
    process.exit(1);
});