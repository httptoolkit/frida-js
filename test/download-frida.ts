import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as stream from 'stream';
import { promisify } from 'util';
import { execSync } from 'child_process';

import * as semver from 'semver';
import { fetch } from 'cross-fetch';

import {
    FRIDA_SERVER_DIR,
    FRIDA_SERVER_BIN
} from './run-frida-server';

const deleteFile = promisify(fs.unlink);
const canAccess = (path: string) => promisify(fs.access)(path).then(() => true).catch(() => false);

const FRIDA_DOWNLOAD_METADATA = path.join(FRIDA_SERVER_DIR, 'metadata.json');

async function setUpLocalEnv() {
    const serverExists = await canAccess(FRIDA_DOWNLOAD_METADATA);
    const currentServerVersion = serverExists
        ? require(FRIDA_DOWNLOAD_METADATA).version
        : null;

    try {
        const latestServerDetails = await getLatestFridaServerDetails();
        const latestServerVersion = latestServerDetails.tag_name;

        if (!serverExists || semver.gt(latestServerVersion, currentServerVersion)) {
            await downloadFridaServer(latestServerDetails);
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

async function getLatestFridaServerDetails(): Promise<any> {
    const headers: { Authorization: string } | {} = process.env.GITHUB_TOKEN
        ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
        : {}

    const response = await fetch(
        'https://api.github.com/repos/frida/frida/releases/latest',
        { headers }
    );
    if (!response.ok) {
        console.log(`${response.status} response, body: `, await response.text(), '\n');
        throw new Error(`Frida releases request rejected with ${response.status}`);
    }

    return response.json();
}

async function downloadFridaServer(
    latestServerDetails: any
) {
    console.log(`Downloading latest frida-server...`);

    const platform = os.platform();
    const arch = os.arch() === 'x64' ? 'x86_64' : os.arch();
    const assetRegex = new RegExp(`frida-server-[\\d\\.]+-${platform}-${arch}\\.xz`);

    if (!latestServerDetails.assets) {
        console.error(JSON.stringify(latestServerDetails, null, 2));
        throw new Error('Could not retrieve latest server assets');
    }

    const asset = latestServerDetails.assets
        .filter((asset: { name: string }) => asset.name.match(assetRegex))[0];

    if (!asset) {
        throw new Error(`No frida-server download available matching ${assetRegex.toString()}`);
    }

    console.log(`Downloading frida-server from ${asset.browser_download_url}...`);

    const downloadPath = path.join(FRIDA_SERVER_DIR, 'frida-server.xz');

    const assetDownload = await fetch(asset.browser_download_url);

    fs.mkdirSync(FRIDA_SERVER_DIR, { recursive: true });
    const assetWrite = (assetDownload.body as any as stream.Readable)
        .pipe(fs.createWriteStream(downloadPath));

    await new Promise((resolve, reject) => {
        assetWrite.on('finish', resolve);
        assetWrite.on('error', reject);
    });

    console.log(`Extracting to ${FRIDA_SERVER_DIR}`);

    await deleteFile(FRIDA_SERVER_BIN).catch((e: any) => {
        if (e.code === 'ENOENT') return;
        else throw e;
    });
    execSync(`xz -k -d '${downloadPath}'`);
    await deleteFile(downloadPath);

    if (!await canAccess(FRIDA_SERVER_BIN)) {
        throw new Error('Frida download completed but server is unexpectedly not available');
    }

    fs.chmodSync(FRIDA_SERVER_BIN, 0o755);

    fs.writeFileSync(FRIDA_DOWNLOAD_METADATA, JSON.stringify({
        version: latestServerDetails.tag_name
    }));

    console.log('Frida-server download completed');
}

setUpLocalEnv().catch(e => {
    console.error(e);
    process.exit(1);
});