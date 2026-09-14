import assert from 'node:assert/strict';
import test from 'node:test';
import { dimensionsToLayout, dimensionsFromLayout, layoutDimension, layoutOverridesInUnits } from './units';

test('metric sample dimensions reach the inch canvas once and save back unchanged', () => {
  const stored = { id: 'top', length: 764, width: 300, thickness: 18, quantity: 1 };
  const canvas = dimensionsToLayout(stored, 'mm');
  assert.ok(Math.abs(canvas.length - 764 / 25.4) < 1e-10);
  assert.equal(layoutDimension(canvas.length, 'in', 'mm'), 764);
  assert.equal(layoutDimension(canvas.width, 'in', 'mm'), 300);
  assert.equal(layoutDimension(canvas.thickness!, 'in', 'mm'), 18);
  assert.deepEqual(dimensionsFromLayout({ id: canvas.id, l: canvas.length, w: canvas.width, t: canvas.thickness! }, 'mm'),
    { id: 'top', l: 764, w: 300, t: 18 });
  const imperial = { length: 24, width: 12, thickness: 0.75 };
  assert.deepEqual(dimensionsToLayout(imperial, 'in'), imperial);
});

test('positions, kerf and padding round-trip without changing IDs, rotation or sheet assignment', () => {
  const stored = {
    'top-0': { x: 25.4, y: 508, rot: true, pinned: true, sheetIndex: 2 },
    'side-1': { x: 0, pinned: false, sheetIndex: 0 },
    'shelf-0': { pinned: false },
  };
  const canvas = layoutOverridesInUnits(stored, 'mm', 'in');
  assert.equal(canvas['top-0'].x, 1);
  assert.equal(canvas['top-0'].y, 20);
  assert.deepEqual(layoutOverridesInUnits(canvas, 'in', 'mm'), stored);
  for (const value of [3.2, 10, 0, 18]) {
    let saved = value;
    for (let i = 0; i < 20; i++) saved = layoutDimension(layoutDimension(saved, 'mm', 'in'), 'in', 'mm');
    assert.equal(saved, value);
  }
});
