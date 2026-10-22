// Usage analytics (PostHog), on the public site only: never on localhost,
// a fork's own deployment, or with ?notrack. No cookies (the anonymous id
// lives in localStorage), no session recordings, no automatic click
// capture: just page views and the handful of events below. Audio and
// file contents never leave the browser; files are reported by kind only.

const projectKey = 'phc_yqi4FYzwPr44C260DHnrRMuNmRzBNtTplqv1R5leQ83'; // public, write-only
const publicHosts = ['phreakguitar.com', 'www.phreakguitar.com', 'phreakguitar.pages.dev'];

type Props = Record<string, string | number | boolean | null | undefined>;
type Client = { capture(event: string, props?: Props, options?: { transport?: 'sendBeacon' }): void };

const enabled = publicHosts.includes(location.hostname)
  && !new URLSearchParams(location.search).has('notrack');

// Loaded after the page is up, so it never delays the rig; events from
// before then wait in the queue.
let client: Client | null = null;
const queue: [string, Props | undefined][] = [];
if (enabled) {
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(projectKey, {
      api_host: 'https://us.i.posthog.com',
      defaults: '2025-05-24',
      persistence: 'localStorage',
      autocapture: false,
      disable_session_recording: true,
      respect_dnt: true,
      person_profiles: 'identified_only',
    });
    client = posthog;
    for (const [e, p] of queue.splice(0)) posthog.capture(e, p);
  }).catch(() => { /* blocked by an extension: fine */ });
}

/** `closing`: sent as the tab goes away, by a beacon that outlives it. */
export function track(event: string, props?: Props, closing = false): void {
  if (!enabled) return;
  if (client) client.capture(event, props, closing ? { transport: 'sendBeacon' } : undefined);
  else if (queue.length < 100) queue.push([event, props]);
}

/** A file or cab choice, without its name: 'builtin', 'saved', 'off'... */
export const kindOf = (value: string) => value.split(':')[0];
