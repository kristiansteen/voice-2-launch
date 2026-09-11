import test from 'node:test';
import assert from 'node:assert/strict';

import { toEmbedUrl } from '../src/lib/videoEmbed.js';

test('toEmbedUrl', async (t) => {
  await t.test('returns null for empty/missing input', () => {
    assert.equal(toEmbedUrl(''), null);
    assert.equal(toEmbedUrl(undefined), null);
    assert.equal(toEmbedUrl('   '), null);
  });

  await t.test('returns null for unparsable input', () => {
    assert.equal(toEmbedUrl('not a url'), null);
  });

  await t.test('rejects non-http(s) schemes', () => {
    assert.equal(toEmbedUrl('javascript:alert(1)'), null);
    assert.equal(toEmbedUrl('ftp://example.com/video'), null);
  });

  await t.test('converts a YouTube watch link', () => {
    assert.equal(
      toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  await t.test('converts a youtu.be short link', () => {
    assert.equal(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  await t.test('converts a YouTube Shorts link', () => {
    assert.equal(
      toEmbedUrl('https://www.youtube.com/shorts/abc123XYZ'),
      'https://www.youtube.com/embed/abc123XYZ'
    );
  });

  await t.test('passes an already-embed YouTube URL through unchanged', () => {
    assert.equal(
      toEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    );
  });

  await t.test('converts a Vimeo link', () => {
    assert.equal(toEmbedUrl('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  });

  await t.test('passes an already-embed Vimeo URL through unchanged', () => {
    assert.equal(
      toEmbedUrl('https://player.vimeo.com/video/76979871'),
      'https://player.vimeo.com/video/76979871'
    );
  });

  await t.test('converts a Loom share link', () => {
    assert.equal(
      toEmbedUrl('https://www.loom.com/share/abcdef1234567890abcdef1234567890'),
      'https://www.loom.com/embed/abcdef1234567890abcdef1234567890'
    );
  });

  await t.test('passes through an unrecognised host as-is', () => {
    assert.equal(toEmbedUrl('https://example.com/video/1'), 'https://example.com/video/1');
  });
});
