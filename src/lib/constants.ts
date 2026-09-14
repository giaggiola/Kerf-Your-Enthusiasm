import { StockPreset } from '@/types';

export const STOCK_PRESETS: StockPreset[] = [
  { name: "4×8 Plywood ¾\"", length: 96, width: 48, thickness: 0.75 },
  { name: "4×8 Plywood ½\"", length: 96, width: 48, thickness: 0.5 },
  { name: "4×8 Plywood ¼\"", length: 96, width: 48, thickness: 0.25 },
  { name: "4×8 MDF ¾\"",     length: 96, width: 48, thickness: 0.75 },
  { name: "5×5 Baltic Birch ¾\"", length: 60, width: 60, thickness: 0.75 },
  { name: "4×8 Plywood", length: 96, width: 48 },
  { name: "4×4 Plywood", length: 48, width: 48 },
  { name: "5×5 Baltic Birch", length: 60, width: 60 },
  { name: "4×8 MDF", length: 96, width: 48 },
];

export const MATERIALS = [
  "Plywood",
  "Baltic Birch",
  "MDF",
  "Melamine",
  "Hardwood",
  "Softwood",
  "Other",
] as const;

export type Material = (typeof MATERIALS)[number];

export const KERF_PRESETS = [
  { value: 0.0625, label: '1/16"' },
  { value: 0.125, label: '1/8"' },
  { value: 0.15625, label: '5/32"' },
] as const;

export const CUT_COLORS = [
  '#64748b',
  '#94a3b8',
  '#475569',
  '#cbd5e1',
  '#334155',
  '#e2e8f0',
];

export const FRACTION_REFERENCE = [
  ['1/16', '.0625'],
  ['1/8', '.125'],
  ['3/16', '.1875'],
  ['1/4', '.25'],
  ['5/16', '.3125'],
  ['3/8', '.375'],
  ['7/16', '.4375'],
  ['1/2', '.5'],
  ['9/16', '.5625'],
  ['5/8', '.625'],
  ['11/16', '.6875'],
  ['3/4', '.75'],
  ['13/16', '.8125'],
  ['7/8', '.875'],
  ['15/16', '.9375'],
  ['1', '1.0'],
] as const;

export const PHI = 1.618;
