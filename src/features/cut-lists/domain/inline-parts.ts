import type { UnitSystem } from '@/types';
import { formatDimension, parseDimension, validateDocument, type Part } from './parts';

export type PartField = 'name' | 'quantity' | 'length' | 'width' | 'thickness' | 'material';
export const partFields: PartField[] = ['name', 'quantity', 'length', 'width', 'thickness', 'material'];
export const fieldLabels: Record<PartField, string> = {
  name: 'Name', quantity: 'Quantity', length: 'Length', width: 'Width', thickness: 'Thickness', material: 'Material',
};
export const isDimension = (field: PartField) => field === 'length' || field === 'width' || field === 'thickness';

export function partFieldText(part: Part, field: PartField, units: UnitSystem) {
  return isDimension(field) ? formatDimension(part[field] as number, units) : String(part[field]);
}

export function editPartField(part: Part, field: PartField, text: string, units: UnitSystem): { part: Part; error?: never } | { error: string; part?: never } {
  if (isDimension(field) && part.source) return { part };
  // Focusing a rounded display value must not change its underlying precision.
  if (text === partFieldText(part, field, units)) return { part };
  let value: string | number = text.trim();
  if (isDimension(field)) {
    const parsed = parseDimension(text.trim() || (field === 'thickness' ? '0' : ''), units);
    if (parsed === null || !Number.isFinite(parsed) || (field === 'thickness' ? parsed < 0 : parsed <= 0))
      return { error: `${fieldLabels[field]} must be ${field === 'thickness' ? 'zero or greater' : 'greater than zero'}.` };
    value = parsed;
  } else if (field === 'quantity') {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
      return { error: 'Quantity must be a positive whole number.' };
    value = Number(value);
  } else if ((field === 'name' && !value) || value.length > 200) {
    return { error: field === 'name' ? 'Enter a name under 200 characters.' : 'Keep material under 200 characters.' };
  }
  const next = { ...part, [field]: value };
  const error = validateDocument({ name: 'Parts', parts: [next] });
  return error ? { error } : { part: next };
}
