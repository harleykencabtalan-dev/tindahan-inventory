import Dexie, { type EntityTable } from 'dexie';
import {
  type Product,
  type Sale,
  type CartItem,
  type StockLog,
  type BusinessType,
  roundNum,
} from './types';

class TindahanDatabase extends Dexie {
  products!: EntityTable<Product, 'id'>;
  sales!: EntityTable<Sale, 'id'>;
  stockLogs!: EntityTable<StockLog, 'id'>;

  constructor() {
    super('TindahanInventoryDB');
    this.version(1).stores({
      products: '++id, name, category, stock, updatedAt',
      sales: '++id, createdAt, voided',
    });
    this.version(2).stores({
      products: '++id, name, category, stock, updatedAt',
      sales: '++id, createdAt, voided, source',
      stockLogs: '++id, createdAt, business, productId',
    });
  }
}

export const db = new TindahanDatabase();

const SEED_FLAG_KEY = 'tindahan_seeded_v1';

const SAMPLE_PRODUCTS: Omit<Product, 'id'>[] = [
  {
    name: 'Dinorado Rice',
    category: 'Rice',
    unit: 'kg',
    price: 62,
    costPrice: 54,
    stock: 75,
    lowStockThreshold: 15,
    updatedAt: Date.now(),
  },
  {
    name: 'Sinandomeng Rice',
    category: 'Rice',
    unit: 'kg',
    price: 56,
    costPrice: 49,
    stock: 50,
    lowStockThreshold: 15,
    updatedAt: Date.now(),
  },
  {
    name: 'Jasmin Rice',
    category: 'Rice',
    unit: 'kg',
    price: 60,
    costPrice: 52,
    stock: 25,
    lowStockThreshold: 10,
    updatedAt: Date.now(),
  },
  {
    name: 'Lucky Me Pancit Canton (Original)',
    category: 'Canned & Noodles',
    unit: 'pack',
    price: 16,
    costPrice: 13,
    stock: 24,
    lowStockThreshold: 6,
    updatedAt: Date.now(),
  },
  {
    name: 'Lucky Me Pancit Canton (Calamansi)',
    category: 'Canned & Noodles',
    unit: 'pack',
    price: 16,
    costPrice: 13,
    stock: 18,
    lowStockThreshold: 6,
    updatedAt: Date.now(),
  },
  {
    name: 'Argentina Corned Beef 150g',
    category: 'Canned & Noodles',
    unit: 'can',
    price: 42,
    costPrice: 36,
    stock: 12,
    lowStockThreshold: 4,
    updatedAt: Date.now(),
  },
  {
    name: 'Coke Mismo 295ml',
    category: 'Drinks',
    unit: 'bottle',
    price: 20,
    costPrice: 15,
    stock: 24,
    lowStockThreshold: 6,
    updatedAt: Date.now(),
  },
  {
    name: 'Nescafe 3-in-1 Twin Pack',
    category: 'Drinks',
    unit: 'sachet',
    price: 15,
    costPrice: 12.5,
    stock: 30,
    lowStockThreshold: 10,
    updatedAt: Date.now(),
  },
  {
    name: 'Piattos Cheese (Small)',
    category: 'Snacks',
    unit: 'pack',
    price: 18,
    costPrice: 14,
    stock: 10,
    lowStockThreshold: 5,
    updatedAt: Date.now(),
  },
  {
    name: 'Silver Swan Soy Sauce (Sachet)',
    category: 'Condiments',
    unit: 'sachet',
    price: 12,
    costPrice: 9.5,
    stock: 15,
    lowStockThreshold: 5,
    updatedAt: Date.now(),
  },
  {
    name: 'Surf Powder Detergent (Sachet)',
    category: 'Toiletries',
    unit: 'sachet',
    price: 9,
    costPrice: 7,
    stock: 5,
    lowStockThreshold: 8,
    updatedAt: Date.now(),
  },
  {
    name: 'Eggs (Medium)',
    category: 'Sari-Sari',
    unit: 'pc',
    price: 9,
    costPrice: 7.5,
    stock: 30,
    lowStockThreshold: 10,
    updatedAt: Date.now(),
  },
];

export async function ensureSeeded(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG_KEY)) return;
  const count = await db.products.count();
  if (count === 0) {
    await db.products.bulkAdd(SAMPLE_PRODUCTS);
  }
  localStorage.setItem(SEED_FLAG_KEY, '1');
}

export async function completeSaleTransaction(
  cart: CartItem[],
  cashReceived: number,
  source: BusinessType
): Promise<Sale> {
  const items = cart.map((c) => {
    const qty = roundNum(c.quantity, 2);
    const subtotal = roundNum(c.product.price * qty);
    const unitCost = c.product.costPrice || 0;
    const itemProfit = roundNum((c.product.price - unitCost) * qty);
    return {
      productId: c.product.id!,
      name: c.product.name,
      unit: c.product.unit,
      price: c.product.price,
      costPrice: unitCost,
      quantity: qty,
      subtotal,
      profit: itemProfit,
    };
  });

  const total = roundNum(items.reduce((sum, item) => sum + item.subtotal, 0));
  const totalCost = roundNum(
    items.reduce((sum, item) => sum + (item.costPrice ?? 0) * item.quantity, 0)
  );
  const profit = roundNum(total - totalCost);
  const change = roundNum(Math.max(0, cashReceived - total));

  const saleRecord: Omit<Sale, 'id'> = {
    source,
    items,
    total,
    totalCost,
    profit,
    cashReceived: roundNum(cashReceived),
    change,
    createdAt: Date.now(),
    voided: false,
  };

  return await db.transaction('rw', db.products, db.sales, async () => {
    for (const item of cart) {
      if (item.product.id == null) continue;
      const current = await db.products.get(item.product.id);
      if (current) {
        const nextStock = Math.max(0, roundNum(current.stock - item.quantity, 2));
        await db.products.update(current.id!, {
          stock: nextStock,
          updatedAt: Date.now(),
        });
      }
    }
    const id = await db.sales.add(saleRecord);
    return { ...saleRecord, id };
  });
}

export async function restockProductTransaction(
  product: Product,
  addQty: number
): Promise<void> {
  if (product.id == null || isNaN(addQty) || addQty <= 0) return;
  const cleanAdd = roundNum(addQty, 2);
  const business: BusinessType =
    product.category === 'Rice' || product.unit === 'kg' ? 'rice' : 'sari-sari';

  await db.transaction('rw', db.products, db.stockLogs, async () => {
    const current = await db.products.get(product.id!);
    if (!current) return;

    await db.products.update(current.id!, {
      stock: roundNum(current.stock + cleanAdd, 2),
      updatedAt: Date.now(),
    });

    await db.stockLogs.add({
      productId: current.id!,
      productName: current.name,
      business,
      unit: current.unit,
      quantityAdded: cleanAdd,
      createdAt: Date.now(),
    });
  });
}

export async function voidSaleTransaction(saleId: number): Promise<void> {
  await db.transaction('rw', db.products, db.sales, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale || sale.voided) return;

    for (const item of sale.items) {
      const current = await db.products.get(item.productId);
      if (current) {
        await db.products.update(current.id!, {
          stock: roundNum(current.stock + item.quantity, 2),
          updatedAt: Date.now(),
        });
      }
    }
    await db.sales.update(saleId, { voided: true });
  });
}

export async function exportAllData(): Promise<string> {
  const products = await db.products.toArray();
  const sales = await db.sales.toArray();
  const stockLogs = await db.stockLogs.toArray();
  return JSON.stringify(
    {
      app: 'TindahanInventory',
      version: 2,
      exportedAt: new Date().toISOString(),
      products,
      sales,
      stockLogs,
    },
    null,
    2
  );
}

export async function importAllData(
  jsonText: string
): Promise<{ products: number; sales: number; stockLogs: number }> {
  const parsed = JSON.parse(jsonText);
  if (!parsed || !Array.isArray(parsed.products)) {
    throw new Error('Invalid backup file format.');
  }

  const products: Product[] = parsed.products;
  const sales: Sale[] = Array.isArray(parsed.sales) ? parsed.sales : [];
  const stockLogs: StockLog[] = Array.isArray(parsed.stockLogs) ? parsed.stockLogs : [];

  await db.transaction('rw', db.products, db.sales, db.stockLogs, async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.stockLogs.clear();
    if (products.length > 0) await db.products.bulkPut(products);
    if (sales.length > 0) await db.sales.bulkPut(sales);
    if (stockLogs.length > 0) await db.stockLogs.bulkPut(stockLogs);
  });

  return { products: products.length, sales: sales.length, stockLogs: stockLogs.length };
}
