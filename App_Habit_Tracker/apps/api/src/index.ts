import { createApp } from './app';

// Durable Object classes must be exported from the Worker's entry module.
export { SyncNotifier } from './sync/sync-notifier';

export default {
  fetch(request, env, ctx) {
    return createApp().fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
