import type { UnitSystem } from '../src/types';

type DemoPart = [name: string, quantity: number, length: number, width: number, thickness: number, material: string, group: string];
type DemoStock = [name: string, quantity: number, length: number, width: number, thickness: number, material: string];

interface DemoList {
  id: string;
  name: string;
  description: string;
  units: UnitSystem;
  kerf: number;
  padding: number;
  parts: DemoPart[];
  stocks: DemoStock[];
}

// Dimensions use each list's storage units. Stable project IDs make seeding
// repeatable without replacing edits or adding duplicate lists.
export const demoLists: DemoList[] = [
  {
    id: 'feef0001-0000-4000-8000-000000000001',
    name: 'Sample — Bookcase',
    description: 'UI sample: a short metric list, repeated shelves, and two sheet thicknesses.',
    units: 'mm', kerf: 3.2, padding: 10,
    parts: [
      ['Side', 2, 1800, 300, 18, 'Baltic Birch', 'Carcass'],
      ['Top', 1, 764, 300, 18, 'Baltic Birch', 'Carcass'],
      ['Bottom', 1, 764, 300, 18, 'Baltic Birch', 'Carcass'],
      ['Adjustable shelf', 4, 764, 280, 18, 'Baltic Birch', 'Shelves'],
      ['Plinth', 1, 764, 80, 18, 'Baltic Birch', 'Carcass'],
      ['Back', 1, 1800, 800, 6, 'Plywood', 'Back'],
    ],
    stocks: [
      ['Birch sheet · 18 mm', 2, 2440, 1220, 18, 'Baltic Birch'],
      ['Plywood sheet · 6 mm', 1, 2440, 1220, 6, 'Plywood'],
    ],
  },
  {
    id: 'feef0001-0000-4000-8000-000000000002',
    name: 'Sample — Drawer cabinet',
    description: 'UI sample: a cabinet and four drawers, with grouped parts and mixed materials.',
    units: 'mm', kerf: 3.2, padding: 10,
    parts: [
      ['Left side', 1, 800, 560, 18, 'Baltic Birch', 'Carcass'],
      ['Right side', 1, 800, 560, 18, 'Baltic Birch', 'Carcass'],
      ['Bottom', 1, 764, 560, 18, 'Baltic Birch', 'Carcass'],
      ['Front stretcher', 1, 764, 100, 18, 'Baltic Birch', 'Carcass'],
      ['Rear stretcher', 1, 764, 100, 18, 'Baltic Birch', 'Carcass'],
      ['Top', 1, 820, 600, 18, 'Baltic Birch', 'Carcass'],
      ['Applied drawer front', 4, 796, 190, 19, 'MDF', 'Drawer faces'],
      ['Drawer side', 8, 500, 140, 12, 'Plywood', 'Drawer boxes'],
      ['Drawer front', 4, 704, 140, 12, 'Plywood', 'Drawer boxes'],
      ['Drawer back', 4, 704, 140, 12, 'Plywood', 'Drawer boxes'],
      ['Drawer bottom', 4, 704, 476, 6, 'Plywood', 'Drawer boxes'],
      ['Cabinet back', 1, 800, 800, 6, 'Plywood', 'Carcass'],
    ],
    stocks: [
      ['Birch sheet · 18 mm', 2, 2440, 1220, 18, 'Baltic Birch'],
      ['MDF sheet · 19 mm', 1, 2440, 1220, 19, 'MDF'],
      ['Plywood sheet · 12 mm', 1, 2440, 1220, 12, 'Plywood'],
      ['Plywood sheet · 6 mm', 2, 2440, 1220, 6, 'Plywood'],
    ],
  },
  {
    id: 'feef0001-0000-4000-8000-000000000003',
    name: 'Sample — Workshop wall storage',
    description: 'UI sample: a longer imperial list for scrolling, long labels, fractions, and groups.',
    units: 'in', kerf: 0.125, padding: 0.5,
    parts: [
      ['Upper cabinet · left side', 1, 30, 12, 0.75, 'Plywood', 'Upper cabinet'],
      ['Upper cabinet · right side', 1, 30, 12, 0.75, 'Plywood', 'Upper cabinet'],
      ['Upper cabinet · top', 1, 34.5, 12, 0.75, 'Plywood', 'Upper cabinet'],
      ['Upper cabinet · bottom', 1, 34.5, 12, 0.75, 'Plywood', 'Upper cabinet'],
      ['Upper cabinet · adjustable shelf', 2, 34.5, 11.25, 0.75, 'Plywood', 'Upper cabinet'],
      ['Upper cabinet · back', 1, 36, 30, 0.25, 'Plywood', 'Upper cabinet'],
      ['Small-parts cubby · left side', 1, 24, 8, 0.5, 'Plywood', 'Small-parts cubby'],
      ['Small-parts cubby · right side', 1, 24, 8, 0.5, 'Plywood', 'Small-parts cubby'],
      ['Small-parts cubby · top', 1, 35, 8, 0.5, 'Plywood', 'Small-parts cubby'],
      ['Small-parts cubby · bottom', 1, 35, 8, 0.5, 'Plywood', 'Small-parts cubby'],
      ['Small-parts cubby · horizontal divider', 2, 35, 8, 0.5, 'Plywood', 'Small-parts cubby'],
      ['Small-parts cubby · vertical divider', 6, 7, 8, 0.5, 'Plywood', 'Small-parts cubby'],
      ['Small-parts cubby · back', 1, 36, 24, 0.25, 'Plywood', 'Small-parts cubby'],
      ['Charging shelf', 1, 24, 10, 0.75, 'Plywood', 'Charging station'],
      ['Charging station · rear cable cover', 1, 24, 3, 0.5, 'Plywood', 'Charging station'],
      ['Charging station · left support', 1, 10, 8, 0.75, 'Plywood', 'Charging station'],
      ['Charging station · right support', 1, 10, 8, 0.75, 'Plywood', 'Charging station'],
      ['Charging station · drill divider', 4, 8, 3, 0.5, 'Plywood', 'Charging station'],
      ['Wall-mounted measuring and marking accessories shelf', 1, 36, 6, 0.75, 'Plywood', 'Accessories'],
      ['Accessories shelf · front lip', 1, 36, 1.5, 0.5, 'Plywood', 'Accessories'],
      ['Accessories shelf · back rail', 1, 36, 3, 0.75, 'Plywood', 'Accessories'],
      ['Mounting rail blank', 4, 36, 3, 0.75, 'Plywood', 'Mounting'],
      ['Spacer block', 8, 3, 2, 0.75, 'Plywood', 'Mounting'],
      ['End cap', 2, 6, 3, 0.5, 'Plywood', 'Accessories'],
    ],
    stocks: [
      ['Plywood sheet · ¾ in', 2, 96, 48, 0.75, 'Plywood'],
      ['Plywood sheet · ½ in', 1, 96, 48, 0.5, 'Plywood'],
      ['Plywood sheet · ¼ in', 1, 96, 48, 0.25, 'Plywood'],
    ],
  },
  {
    id: 'feef0001-0000-4000-8000-000000000004',
    name: 'Sample — New idea',
    description: 'UI sample: an empty saved list, ready for the first manual part or 3D import.',
    units: 'mm', kerf: 3.2, padding: 10,
    parts: [], stocks: [],
  },
];
