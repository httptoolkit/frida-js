export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isNode = !!globalThis.process?.versions.node;