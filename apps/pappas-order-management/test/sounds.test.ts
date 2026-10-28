import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadPlayer() {
  const events: string[] = [];
  const playing: { finish: () => void }[] = [];
  let failNext = false;
  const output = ts.transpileModule(readFileSync('lib/sounds.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', output)((id: string) => {
    if (id === 'react-native') return { Platform: { OS: 'ios' } };
    if (id.endsWith('sound-assets.generated')) return { SOUND_ASSETS: { first: 'first', second: 'second' }, SOUND_OPTIONS: [] };
    if (id === 'expo-av') return { Audio: { setAudioModeAsync: async () => {}, Sound: { createAsync: async (asset: string) => {
      let callback: ((status: any) => void) | null = null;
      return { sound: {
        setPositionAsync: async () => {}, unloadAsync: async () => { events.push(`unload:${asset}`); },
        setOnPlaybackStatusUpdate: (listener: typeof callback) => { callback = listener; },
        playAsync: async () => {
          events.push(`play:${asset}`);
          if (failNext) { failNext = false; throw new Error('audio unavailable'); }
          playing.push({ finish: () => callback?.({ isLoaded: true, didJustFinish: true }) });
        },
      } };
    } } } };
    throw new Error(id);
  }, module, module.exports);
  return { play: module.exports.playNewOrderSound, events, playing, fail: () => { failNext = true; } };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
test('overlapping alerts queue instead of dropping the second provider sound', async () => {
  const player = loadPlayer();
  const first = player.play({ soundId: 'first', repeatCount: 1, delayMs: 0 });
  const second = player.play({ soundId: 'second', repeatCount: 1, delayMs: 0 });
  await tick();
  assert.deepEqual(player.events, ['play:first']);
  player.playing[0].finish();
  await tick();
  assert.deepEqual(player.events, ['play:first', 'unload:first', 'play:second']);
  player.playing[1].finish();
  await Promise.all([first, second]);
});
test('a failed alert does not block later alerts', async () => {
  const player = loadPlayer();
  player.fail();
  const failed = player.play({ soundId: 'first', repeatCount: 1 });
  const next = player.play({ soundId: 'second', repeatCount: 1 });
  await tick();
  assert.ok(player.events.includes('play:second'));
  player.playing[0].finish();
  await Promise.all([failed, next]);
});
