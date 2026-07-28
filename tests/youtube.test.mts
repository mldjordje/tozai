import assert from "node:assert/strict";
import test from "node:test";
import { embedUrl, parseYouTubeId, posterCandidates } from "../lib/youtube.ts";

const id = "dQw4w9WgXcQ";

test("YouTube parser accepts share, Shorts, watch and embed links", () => {
  for (const value of [
    id,
    `https://youtube.com/shorts/${id}`,
    `youtu.be/${id}`,
    `https://www.youtube.com/watch?v=${id}`,
    `https://m.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) {
    assert.equal(parseYouTubeId(value), id, value);
  }
});

test("YouTube parser rejects unrelated and malformed links", () => {
  assert.equal(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseYouTubeId("https://youtube.com/shorts/too-short"), null);
  assert.equal(parseYouTubeId(""), null);
});

test("portfolio media uses privacy-enhanced embeds and vertical poster first", () => {
  assert.match(embedUrl(id), /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.equal(posterCandidates(id)[0], `https://i.ytimg.com/vi/${id}/oardefault.jpg`);
});
