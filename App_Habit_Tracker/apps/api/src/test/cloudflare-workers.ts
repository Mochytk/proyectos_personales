// Stands in for the `cloudflare:workers` module when the API tests run in Node. Only what
// our Durable Object uses: the base class keeps ctx and env, as the real one does.
export class DurableObject<E = unknown> {
  protected ctx: DurableObjectState;
  protected env: E;

  constructor(ctx: DurableObjectState, env: E) {
    this.ctx = ctx;
    this.env = env;
  }
}
