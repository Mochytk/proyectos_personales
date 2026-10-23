// Web Crypto and TextEncoder exist in browsers, Node 24 and Cloudflare Workers.
// This package compiles without DOM or Node types, so it declares only what it uses.
declare const crypto: {
  readonly subtle: {
    digest(algorithm: 'SHA-1' | 'SHA-256', data: Uint8Array): Promise<ArrayBuffer>;
  };
};

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
