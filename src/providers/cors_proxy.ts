// Dev-only CORS proxy for provider asset CDNs.
//
// Several providers (Seedance/BytePlus TOS, Veo media URIs, Kling temporary
// hosts) return signed URLs from CDN buckets that don't set
// `Access-Control-Allow-Origin`. Browsers refuse those fetches even though
// the upload was successful and the URL is reachable.
//
// In `npm run dev` the Vite middleware at `/cors-proxy` (see vite.config.ts)
// fetches the URL server-side and forwards the bytes back, sidestepping CORS.
// In production builds the original URL is used unchanged — production needs
// the macOS wrapper or a real backend hop, neither of which exists yet.

const PROXIED_HOSTS = [
  'volces.com',           // BytePlus TOS (Seedance)
  'googleusercontent.com', // Veo / generated media
  'googleapis.com',        // Veo files endpoint
  'klingai.com',           // Kling
]

export function corsProxy(url: string): string {
  if (!import.meta.env.DEV) return url
  let host = ''
  try { host = new URL(url).hostname } catch { return url }
  if (!PROXIED_HOSTS.some(h => host === h || host.endsWith('.' + h))) return url
  return `/cors-proxy?url=${encodeURIComponent(url)}`
}
