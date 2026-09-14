import assert from 'node:assert/strict';
import test from 'node:test';
import { editPartField, partFieldText } from './inline-parts';
import {
  parseDimension,
  partFromStorage,
  partToStorage,
  validateDocument,
} from './parts';

const stored = {
  id: 'part-1',
  label: 'Shelf',
  length: 24,
  width: 12,
  thickness: 0.75,
  quantity: 2,
  material: 'Plywood',
  groupName: 'Cabinet',
  stepFileId: 'file-1',
  stepBodyIndex: 0,
  stepFaceIndex: 0,
};

test('inline edits validate quantities and dimensions while preserving source and display precision', () => {
  const part = { ...partFromStorage(stored, 'in'), source: undefined };
  assert.ok(Math.abs(editPartField(part, 'thickness', '3/4', 'in').part!.thickness - 19.05) < 1e-10);
  assert.equal(editPartField(part, 'length', '764', 'mm').part?.length, 764);
  assert.equal(editPartField(part, 'name', 'Top', 'mm').part?.id, part.id);
  for (const quantity of ['0', '-1', '1.5', '1e3', '2abc', ''])
    assert.ok(editPartField(part, 'quantity', quantity, 'mm').error);
  assert.ok(editPartField(part, 'length', '0', 'mm').error);
  assert.ok(editPartField(part, 'name', ' ', 'mm').error);
  assert.equal(editPartField(part, 'thickness', '', 'mm').part?.thickness, 0);
  const precise = { ...part, length: 764.123456789 };
  assert.equal(editPartField(precise, 'length', partFieldText(precise, 'length', 'in'), 'in').part?.length, precise.length);
  const imported = partFromStorage(stored, 'in');
  assert.deepEqual(editPartField(imported, 'length', '100', 'mm').part, imported);
  assert.deepEqual(editPartField(imported, 'material', 'Oak', 'mm').part?.source, imported.source);
});

test('inch fractions, decimals and metric input describe the same physical length', () => {
  assert.ok(
    Math.abs(parseDimension('24', 'in')! - parseDimension('609.6', 'mm')!) <
      1e-9,
  );
  assert.ok(Math.abs(parseDimension('3/4', 'in')! - 19.05) < 1e-9);
  assert.ok(Math.abs(parseDimension('1 1/2', 'in')! - 38.1) < 1e-10);
  for (const invalid of ['-1', 'Infinity', '1/0', '24abc', '', '1e3', '2+3'])
    assert.equal(parseDimension(invalid, 'in'), null);
  assert.equal(parseDimension('1/2', 'mm'), null);
});

test('source identity and dimensions survive the storage boundary', () => {
  const part = partFromStorage(stored, 'in', { 'file-1': 'cabinet.step' });
  assert.ok(Math.abs(part.length - 609.6) < 1e-9);
  assert.equal(part.source?.filename, 'cabinet.step');
  const roundTrip = partToStorage(part, 'in');
  assert.equal(roundTrip.id, stored.id);
  assert.equal(roundTrip.l, 24);
  assert.equal(roundTrip.w, 12);
  assert.equal(roundTrip.t, 0.75);
  assert.equal(roundTrip.stepBodyIndex, 0);
  assert.equal(roundTrip.stepFaceIndex, 0);
  assert.equal(roundTrip.group, 'Cabinet');
  assert.ok(Math.abs(partToStorage(part, 'mm').l - 609.6) < 1e-9);
});

test('equal names and sizes stay separate parts; duplicate identities and invalid quantities fail', () => {
  const part = partFromStorage(stored, 'in');
  assert.equal(
    validateDocument({
      name: 'Cabinet',
      parts: [part, { ...part, id: 'part-2', source: undefined }],
    }),
    null,
  );
  assert.match(
    validateDocument({ name: 'Cabinet', parts: [part, part] })!,
    /unique identity/,
  );
  for (const quantity of [0, -1, 1.5, NaN])
    assert.match(
      validateDocument({ name: 'Cabinet', parts: [{ ...part, quantity }] })!,
      /quantity/,
    );
  assert.match(
    validateDocument({ name: 'Cabinet', parts: [{ ...part, length: 0 }] })!,
    /length and width/,
  );
});
