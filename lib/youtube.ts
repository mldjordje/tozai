// YouTube link handling for the portfolio.
//
// The studio pastes whatever URL it copied — a Shorts link from the phone, a
// share link, a desktop watch URL — and every one of those has to resolve to
// the same 11-character video id. Pure and dependency-free so both the admin
// form (client) and the API route (server) can use it.

/** YouTube video ids are exactly 11 chars of the URL-safe base64 alphabet. */
const ID = /^[A-Za-z0-9_-]{11}$/;

const PATHS = [
  /^\/shorts\/([A-Za-z0-9_-]{11})/,
  /^\/embed\/([A-Za-z0-9_-]{11})/,
  /^\/live\/([A-Za-z0-9_-]{11})/,
  /^\/v\/([A-Za-z0-9_-]{11})/,
];

/**
 * Extract the video id from any YouTube URL, or from a bare id.
 * Returns null when the input is not a YouTube reference at all — the caller
 * decides whether that is an error or just "this work is a hosted file".
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (ID.test(value)) return value;

  let url: URL;
  try {
    // People paste "youtube.com/shorts/…" without the scheme as often as with.
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const v = url.searchParams.get("v");
  if (v && ID.test(v)) return v;

  for (const pattern of PATHS) {
    const match = url.pathname.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Poster candidates, best first.
 *
 * `oardefault` is the original-aspect-ratio still — the only one that is
 * actually vertical for a Short. The 16:9 stills are kept as fallbacks because
 * not every video has every size, but cropping one into a 9:16 card throws away
 * most of the frame, so they are a last resort rather than the default.
 */
export function posterCandidates(videoId: string): string[] {
  return [
    `https://i.ytimg.com/vi/${videoId}/oardefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

/**
 * Player URL for the click-to-play embed.
 *
 * `youtube-nocookie.com` keeps YouTube from setting tracking cookies until the
 * visitor actually asks to watch. The parameters strip what can be stripped —
 * control bar, related videos, annotations. The title and the "Watch on
 * YouTube" affordance cannot be removed through a public embed and must not be
 * covered over: that is against YouTube's terms. The card frame around the
 * player is what makes it read as ours.
 */
export function embedUrl(videoId: string, { autoplay = true } = {}): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    loop: "1",
    // A single-video loop needs the id repeated in a playlist; without it the
    // player ignores loop entirely.
    playlist: videoId,
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}
