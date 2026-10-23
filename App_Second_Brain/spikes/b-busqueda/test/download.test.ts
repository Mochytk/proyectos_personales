import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { verifies } from '../src/download.ts';

test('LFS files are checked against their SHA-256', () => {
  const bytes = Buffer.from('pesos del modelo');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(verifies({ rfilename: 'onnx/model.onnx', lfs: { sha256, size: bytes.length } }, bytes), true);
  assert.equal(verifies({ rfilename: 'onnx/model.onnx', lfs: { sha256, size: bytes.length } }, Buffer.from('otro')), false);
});

test('small files are checked against their git blob SHA-1', () => {
  // `printf '{}' | git hash-object --stdin` = 9e26dfeeb6e641a33dae4961196235bdb965b21b
  assert.equal(verifies({ rfilename: 'config.json', blobId: '9e26dfeeb6e641a33dae4961196235bdb965b21b' }, Buffer.from('{}')), true);
  assert.equal(verifies({ rfilename: 'config.json', blobId: '9e26dfeeb6e641a33dae4961196235bdb965b21b' }, Buffer.from('{ }')), false);
  assert.equal(verifies({ rfilename: 'config.json' }, Buffer.from('{}')), false);
});
