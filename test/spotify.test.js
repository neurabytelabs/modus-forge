import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferMood, getMusicContext, spotifyContext } from '../skills/music/spotify.js';

describe('Spotify Skill', () => {
  describe('inferMood', () => {
    it('returns default mood for null track', () => {
      const mood = inferMood(null);
      assert.equal(mood.energy, 'medium');
      assert.ok(mood.palette);
      assert.ok(mood.vibe);
      assert.ok(mood.fontHint);
    });

    it('detects lo-fi mood', () => {
      const mood = inferMood({ name: 'Chill Beats', artist: 'Lo-Fi Girl', album: 'Study' });
      assert.equal(mood.energy, 'low');
      assert.ok(mood.palette.includes('muted'));
    });

    it('detects electronic mood', () => {
      const mood = inferMood({ name: 'Strobe', artist: 'Deadmau5', album: 'Techno Nights' });
      assert.equal(mood.energy, 'high');
      assert.ok(mood.palette.includes('neon'));
    });

    it('detects metal mood', () => {
      const mood = inferMood({ name: 'Master of Puppets', artist: 'Metallica', album: 'Metal Up' });
      assert.equal(mood.energy, 'high');
      assert.ok(mood.palette.includes('red'));
    });

    it('detects classical mood', () => {
      const mood = inferMood({ name: 'Moonlight Sonata', artist: 'Beethoven', album: 'Piano Works' });
      assert.equal(mood.energy, 'medium');
      assert.ok(mood.palette.includes('ivory'));
    });

    it('detects hip-hop mood', () => {
      const mood = inferMood({ name: 'Trap Queen', artist: 'Fetty Wap', album: 'Hip Hop Hits' });
      assert.equal(mood.energy, 'high');
    });

    it('detects folk mood', () => {
      const mood = inferMood({ name: 'Rivers', artist: 'Acoustic Folk Band', album: 'Campfire' });
      assert.equal(mood.energy, 'low');
      assert.ok(mood.palette.includes('brown'));
    });

    it('falls back to default for unknown genre', () => {
      const mood = inferMood({ name: 'Xyz', artist: 'Abc', album: 'Qrs' });
      assert.equal(mood.energy, 'medium');
    });
  });

  describe('getMusicContext', () => {
    it('returns structured context object', () => {
      const ctx = getMusicContext();
      assert.ok('track' in ctx);
      assert.ok('mood' in ctx);
      assert.ok('context' in ctx);
      assert.ok(typeof ctx.context === 'string');
    });
  });

  describe('spotifyContext', () => {
    it('returns string (empty or formatted)', () => {
      const ctx = spotifyContext();
      assert.ok(typeof ctx === 'string');
    });
  });
});
