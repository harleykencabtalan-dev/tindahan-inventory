export type BusinessType = 'sari-sari' | 'rice';

export type StoreCategory =
  | 'Rice'
  | 'Drinks'
  | 'Snacks'
  | 'Canned & Noodles'
  | 'Condiments'
  | 'Toiletries'
  | 'Sari-Sari';

export type UnitType = 'kg' | 'pc' | 'pack' | 'sachet' | 'bottle' | 'can';

export const SARI_SARI_CATEGORIES: { id: Exclude<StoreCategory, 'Rice'>; label: string }[] = [
  { id: 'Drinks', label: 'Drinks' },
  { id: 'Snacks', label: 'Snacks' },
  { id: 'Canned & Noodles', label: 'Canned & Noodles' },
  { id: 'Condiments', label: 'Condiments' },
  { id: 'Toiletries', label: 'Toiletries' },
  { id: 'Sari-Sari', label: 'Other Sari-Sari' },
];

export const SARI_SARI_UNITS: { id: Exclude<UnitType, 'kg'>; label: string }[] = [
  { id: 'pc', label: 'pc (piraso)' },
  { id: 'pack', label: 'pack' },
  { id: 'sachet', label: 'sachet' },
  { id: 'bottle', label: 'bottle' },
  { id: 'can', label: 'can' },
];

export interface Product {
  id?: string;
  name: string;
  category: StoreCategory;
  unit: UnitType;
  price: number;        // Selling price per unit (or per kg)
  costPrice: number;    // Cost price per unit (for reference)
  stock: number;        // Current stock (supports decimals for kg)
  lowStockThreshold: number;
  updatedAt: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  unit: UnitType;
  price: number;
  costPrice?: number;
  quantity: number;
  subtotal: number;
  profit?: number;
}

export interface Sale {
  id?: string;
  source?: BusinessType;
  items: SaleItem[];
  total: number;
  totalCost?: number;
  profit?: number;
  cashReceived: number;
  change: number;
  createdAt: number;
  voided?: boolean;
}

export interface StockLog {
  id?: string;
  productId: string;
  productName: string;
  business: BusinessType;
  unit: UnitType;
  quantityAdded: number;
  createdAt: number;
}

export function getSaleSource(sale: Sale): BusinessType {
  if (sale.source) return sale.source;
  const allKg = sale.items.length > 0 && sale.items.every((i) => i.unit === 'kg');
  return allKg ? 'rice' : 'sari-sari';
}

export function roundNum(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export const KG_PER_SACK = 25;

export function splitRiceKg(
  totalKg: number,
  kgPerSack = KG_PER_SACK
): { sacks: number; extraKg: number } {
  const clean = Math.max(0, roundNum(totalKg, 2));
  const sacks = Math.floor(clean / kgPerSack);
  const extraKg = roundNum(clean - sacks * kgPerSack, 2);
  return { sacks, extraKg };
}

export function formatRiceStock(totalKg: number, kgPerSack = KG_PER_SACK): string {
  const { sacks, extraKg } = splitRiceKg(totalKg, kgPerSack);
  if (sacks > 0 && extraKg > 0) {
    return `${sacks} sack${sacks === 1 ? '' : 's'} + ${extraKg} kg`;
  }
  if (sacks > 0) {
    return `${sacks} sack${sacks === 1 ? '' : 's'} (${roundNum(totalKg, 2)} kg)`;
  }
  return `${roundNum(totalKg, 2)} kg`;
}

export function formatQty(qty: number, unit: UnitType): string {
  const clean = roundNum(qty, 2);
  if (unit === 'kg') {
    return formatRiceStock(clean, KG_PER_SACK);
  }
  return `${clean} ${unit}${clean !== 1 && unit === 'pc' ? 's' : ''}`;
}
