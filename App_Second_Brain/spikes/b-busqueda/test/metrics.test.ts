import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recallAt, reciprocalRank } from '../src/metrics.ts';
import { rrf } from '../src/rrf.ts';

test('recall@k counts expected ids inside the top k', () => {
  assert.equal(recallAt(['a'], ['x', 'y', 'a'], 5), 1);
  assert.equal(recallAt(['a'], ['x', 'y', 'z', 'w', 'v', 'a'], 5), 0);
  assert.equal(recallAt(['a', 'b'], ['a', 'x'], 5), 0.5);
});

test('reciprocal rank uses the first expected hit', () => {
  assert.equal(reciprocalRank(['a'], ['x', 'a']), 0.5);
  assert.equal(reciprocalRank(['a'], ['x']), 0);
});

test('RRF rewards ids that rank well in both lists', () => {
  const fused = rrf([['x', 'shared'], ['shared', 'y']]);
  assert.equal(fused[0], 'shared');
});
