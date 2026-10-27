// The only Node global the Playwright config reads; declared here instead of pulling in
// all of @types/node.
declare const process: { env: Record<string, string | undefined> };
