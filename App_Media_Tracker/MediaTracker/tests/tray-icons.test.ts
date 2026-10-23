import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PNG } = require('pngjs');

const read = (name: string) => PNG.sync.read(fs.readFileSync(path.join(__dirname, '..', 'build', name)));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

describe('menu bar icon (macOS template image)', () => {
  for (const [file, size] of [['trayTemplate.png', 22], ['trayTemplate@2x.png', 44]] as const) {
    describe(file, () => {
      const png = read(file);

      it(`is ${size}x${size}`, () => {
        expect([png.width, png.height]).toEqual([size, size]);
      });

      it('is black on transparent, as a template image must be so macOS can tint it', () => {
        let opaque = 0;
        for (let i = 0; i < png.data.length; i += 4) {
          const [r, g, b, a] = [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
          if (a > 0) {
            opaque++;
            expect([r, g, b]).toEqual([0, 0, 0]);
          }
        }
        expect(opaque).toBeGreaterThan(size * size * 0.15); // there is a drawing
        expect(opaque).toBeLessThan(size * size * 0.85); // and it is not a solid square
      });

      it('has a transparent border, so the drawing is not cut off', () => {
        const alphaAt = (x: number, y: number) => png.data[(y * size + x) * 4 + 3];
        for (let i = 0; i < size; i++) {
          expect(alphaAt(i, 0)).toBe(0);
          expect(alphaAt(i, size - 1)).toBe(0);
          expect(alphaAt(0, i)).toBe(0);
          expect(alphaAt(size - 1, i)).toBe(0);
        }
      });
    });
  }

  it('ships with the app', () => {
    for (const file of ['electron-tray.js', 'build/trayTemplate.png', 'build/trayTemplate@2x.png']) {
      expect(pkg.build.files).toContain(file);
    }
  });
});
