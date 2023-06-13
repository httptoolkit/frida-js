import * as os from 'os';
import { Readable, PassThrough } from 'stream';

import { XzReadableStream } from 'xz-decompress';

interface FridaDownloadOptions {
    /**
     * The Frida version to download - either a version like '16.0.19' or 'latest'
     */
    version: string,

    // The specific values below are the currently available platforms & architectures for Frida
    // server as of v16.0.19.

    /**
     * The target Frida platform. Not all platforms are available, and these do not exactly match
     * Node'js os.platform() values. If no platform is specified, this defaults to the current platform.
     *
     * If the platform + arch combination requested is not available, an error will be raised during
     * the download process.
     */
    platform?:
        | 'android'
        | 'freebsd'
        | 'linux'
        | 'macos'
        | 'qnx'
        | 'windows',

    /**
     * The target Frida architecture. Not all architecture are available, and these do not exactly match
     * Node'js os.arch() values. If no arch is specified, this defaults to the current architecture.
     *
     * If the platform + arch combination requested is not available, an error will be raised during
     * the download process.
     */
    arch?:
        | 'arm'
        | 'arm64'
        | 'arm64e'
        | 'arm64-musl'
        | 'armeabi'
        | 'x86'
        | 'x86_64'
        | 'x86_64-musl'
        | 'armhf'
        | 'mips'
        | 'mipsel'
        | 'mips64'
        | 'mips64el',

    /**
     * Optionally a GitHub token can be provided. If set it will be used to download Frida, thereby
     * avoiding some GitHub rate limiting that can otherwise block downloads. If not set, a token
     * from process.env.GITHUB_TOKEN will be used if available, or the request will be sent
     * anonymously.
     */
    ghToken?: string
}

export async function downloadFridaServer(options: FridaDownloadOptions) {
    const { version, platform, arch, ghToken } = options;

    const releaseDetails = await getFridaReleaseDetails(
        version,
        ghToken || process.env.GITHUB_TOKEN
    );

    const downloadUrl = findFridaDownloadUrl(releaseDetails.assets, {
        version,
        platform: platform || os.platform(),
        arch: arch || os.arch()
    });

    return fetchFridaServer(downloadUrl);
}

export async function getFridaReleaseDetails(version?: string, ghToken?: string): Promise<any> {
    const headers: { Authorization: string } | {} = !!ghToken
        ? { Authorization: `token ${ghToken}` }
        : {}

    const response = await fetch(
        `https://api.github.com/repos/frida/frida/releases/${
            version && version !== 'latest'
            ? `tags/${version}`
            : 'latest'
        }`,
        { headers }
    );

    if (!response.ok) {
        console.warn(`Frida releases ${response.status} response, body: `, await response.text(), '\n');
        throw new Error(`Frida releases request rejected with ${response.status}`);
    }

    return response.json();
}

function findFridaDownloadUrl(
    assets: Array<{ name: string, browser_download_url: string }>,
    releaseOptions: { version: string, platform: string, arch: string }
) {
    let { version, arch, platform } = releaseOptions;

    // Map some os.platform()/arch() results into Frida format:
    if (platform === 'darwin') platform = 'macos';
    if (platform === 'win32') platform = 'windows';
    if (arch === 'x64') { arch = 'x86_64' };

    let extension = platform === 'windows' ? 'exe\\.xz' : 'xz';

    const assetRegex = new RegExp(`frida-server-${version}-${platform}-${arch}\\.${extension}`);

    const asset = assets.find((asset: { name: string }) => asset.name.match(assetRegex));
    if (!asset) {
        console.warn(`No Frida release asset found matching ${assetRegex.toString()}`);
        throw new Error(`No ${version} frida-server download available for ${platform} ${arch}`);
    }

    return asset.browser_download_url;
}

async function fetchFridaServer(
    downloadUrl: string
): Promise<Readable> {
    const resultStream = new PassThrough();

    const assetDownload = await fetch(downloadUrl);
    if (!assetDownload.ok) {
        throw new Error(`Frida server download was unsuccessful, returned ${assetDownload.status}`);
    }
    if (!assetDownload.body) {
        throw new Error('No body available for Frida server download');
    }

    // Actually start streaming the body next tick, to ensure there's time to set up
    // any error handlers required on the returned stream before it begins.
    setTimeout(() => {
        // Decompress the .xz file to a raw file stream (no tar - it's a single file)
        const decodeStream = Readable.fromWeb(
            // Node web stream & DOM web stream types aren't a perfect match so we have to cast:
            new XzReadableStream(assetDownload.body!) as any
        );

        decodeStream.pipe(resultStream);
        decodeStream.on('error', (e) => resultStream.emit('error', e));
    }, 0);

    return resultStream;
}