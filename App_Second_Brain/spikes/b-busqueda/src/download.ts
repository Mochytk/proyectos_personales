// Downloads model files from Hugging Face at a pinned revision and verifies every file:
// LFS files against their published SHA-256, small files against their git blob SHA-1.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { filesFor, type ModelSpec } from './models.ts';

interface Sibling {
  rfilename: string;
  size?: number;
  blobId?: string;
  lfs?: { sha256: string; size: number };
}

interface ModelInfo {
  sha: string;
  siblings: Sibling[];
  cardData?: { license?: string };
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${String(bytes.length)}\0`).update(bytes).digest('hex');
}

export function verifies(file: Sibling, bytes: Buffer): boolean {
  if (file.lfs) return sha256(bytes) === file.lfs.sha256;
  return file.blobId !== undefined && gitBlobSha1(bytes) === file.blobId;
}

export async function ensureModel(spec: ModelSpec, modelsDir: string): Promise<{ revision: string; license: string; bytes: number }> {
  const response = await fetch(`https://huggingface.co/api/models/${spec.repo}/revision/main?blobs=true`);
  if (!response.ok) throw new Error(`no pude leer ${spec.repo} (${String(response.status)})`);
  const info = (await response.json()) as ModelInfo;
  let total = 0;
  for (const name of filesFor(spec)) {
    const sibling = info.siblings.find((entry) => entry.rfilename === name);
    if (!sibling) throw new Error(`${spec.repo} no tiene ${name}`);
    const target = join(modelsDir, spec.repo, name);
    let bytes = existsSync(target) ? readFileSync(target) : null;
    if (bytes === null || !verifies(sibling, bytes)) {
      process.stderr.write(`  descargando ${spec.repo}/${name} ...\n`);
      const file = await fetch(`https://huggingface.co/${spec.repo}/resolve/${info.sha}/${name}`);
      if (!file.ok) throw new Error(`descarga fallida: ${name} (${String(file.status)})`);
      bytes = Buffer.from(await file.arrayBuffer());
      if (!verifies(sibling, bytes)) throw new Error(`${spec.repo}/${name} no coincide con su hash publicado; no se usa`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
    total += bytes.length;
  }
  return { revision: info.sha, license: info.cardData?.license ?? 'sin dato', bytes: total };
}
