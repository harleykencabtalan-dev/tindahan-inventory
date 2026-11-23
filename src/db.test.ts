import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  completeSaleTransaction,
  voidSaleTransaction,
  restockProductTransaction,
  exportAllData,
  importAllData,
} from './db';
import {
  formatPeso,
  formatQty,
  getSaleSource,
  roundNum,
  type Product,
} from './types';

describe('Helper Functions (Unit Tests)', () => {
  it('formats Philippine peso amounts cleanly', () => {
    expect(formatPeso(0)).toBe('₱0');
    expect(formatPeso(56)).toBe('₱56');
    expect(formatPeso(1250.5)).toBe('₱1,250.50');
  });

  it('formats rice kilos with sack equivalents at 25 kg per sack', () => {
    expect(formatQty(10, 'kg')).toBe('10 kg');
    expect(formatQty(25, 'kg')).toBe('25 kg (1 sack)');
    expect(formatQty(75, 'kg')).toBe('75 kg (3 sacks)');
    expect(formatQty(1, 'pc')).toBe('1 pc');
    expect(formatQty(5, 'pc')).toBe('5 pcs');
  });

  it('avoids floating-point rounding bugs', () => {
    expect(roundNum(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundNum(62 * 0.25, 2)).toBe(15.5);
  });

  it('infers sale source for older sales without a source field', () => {
    expect(
      getSaleSource({
        items: [{ productId: 1, name: 'Dinorado', unit: 'kg', price: 62, quantity: 2, subtotal: 124 }],
        total: 124,
        cashReceived: 150,
        change: 26,
        createdAt: Date.now(),
      })
    ).toBe('rice');

    expect(
      getSaleSource({
        items: [{ productId: 2, name: 'Coke', unit: 'bottle', price: 20, quantity: 1, subtotal: 20 }],
        total: 20,
        cashReceived: 20,
        change: 0,
        createdAt: Date.now(),
      })
    ).toBe('sari-sari');
  });
});

describe('Inventory & POS Transactions (Integration Tests)', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.stockLogs.clear();
  });

  it('deducts rice stock accurately in decimals and snapshots profit', async () => {
    // Arrange
    const riceId = await db.products.add({
      name: 'Dinorado Rice',
      category: 'Rice',
      unit: 'kg',
      price: 62,
      costPrice: 54,
      stock: 50,
      lowStockThreshold: 15,
      updatedAt: Date.now(),
    });
    const rice = (await db.products.get(riceId)) as Product;

    // Act: sell 2.5 kg for ₱200 cash
    const sale = await completeSaleTransaction([{ product: rice, quantity: 2.5 }], 200, 'rice');

    // Assert
    const updatedRice = await db.products.get(riceId);
    expect(updatedRice?.stock).toBe(47.5);
    expect(sale.source).toBe('rice');
    expect(sale.total).toBe(155);       // 62 * 2.5
    expect(sale.totalCost).toBe(135);   // 54 * 2.5
    expect(sale.profit).toBe(20);       // 155 - 135
    expect(sale.change).toBe(45);       // 200 - 155
  });

  it('voiding a sale restores stock and prevents double-voiding', async () => {
    const cokeId = await db.products.add({
      name: 'Coke Mismo',
      category: 'Drinks',
      unit: 'bottle',
      price: 20,
      costPrice: 15,
      stock: 10,
      lowStockThreshold: 4,
      updatedAt: Date.now(),
    });
    const coke = (await db.products.get(cokeId)) as Product;

    const sale = await completeSaleTransaction([{ product: coke, quantity: 3 }], 100, 'sari-sari');
    expect((await db.products.get(cokeId))?.stock).toBe(7);

    // First void restores 3 bottles
    await voidSaleTransaction(sale.id!);
    expect((await db.products.get(cokeId))?.stock).toBe(10);
    expect((await db.sales.get(sale.id!))?.voided).toBe(true);

    // Second void should be a no-op (stock must NOT become 13)
    await voidSaleTransaction(sale.id!);
    expect((await db.products.get(cokeId))?.stock).toBe(10);
  });

  it('never lets stock drop below 0', async () => {
    const eggId = await db.products.add({
      name: 'Eggs',
      category: 'Sari-Sari',
      unit: 'pc',
      price: 9,
      costPrice: 7.5,
      stock: 2,
      lowStockThreshold: 5,
      updatedAt: Date.now(),
    });
    const egg = (await db.products.get(eggId)) as Product;

    await completeSaleTransaction([{ product: egg, quantity: 5 }], 50, 'sari-sari');
    expect((await db.products.get(eggId))?.stock).toBe(0);
  });

  it('restocking increases stock and writes a stockLog entry', async () => {
    const riceId = await db.products.add({
      name: 'Sinandomeng Rice',
      category: 'Rice',
      unit: 'kg',
      price: 56,
      costPrice: 49,
      stock: 10,
      lowStockThreshold: 15,
      updatedAt: Date.now(),
    });
    const rice = (await db.products.get(riceId)) as Product;

    await restockProductTransaction(rice, 25);

    const updated = await db.products.get(riceId);
    const logs = await db.stockLogs.toArray();
    expect(updated?.stock).toBe(35);
    expect(logs).toHaveLength(1);
    expect(logs[0].business).toBe('rice');
    expect(logs[0].quantityAdded).toBe(25);
  });

  it('exports and restores all data via JSON backup without data loss', async () => {
    const id = await db.products.add({
      name: 'Nescafe 3-in-1',
      category: 'Drinks',
      unit: 'sachet',
      price: 15,
      costPrice: 12,
      stock: 20,
      lowStockThreshold: 5,
      updatedAt: Date.now(),
    });
    const item = (await db.products.get(id)) as Product;
    await restockProductTransaction(item, 10);
    await completeSaleTransaction([{ product: item, quantity: 2 }], 50, 'sari-sari');

    const json = await exportAllData();

    // Wipe DB completely
    await db.products.clear();
    await db.sales.clear();
    await db.stockLogs.clear();

    const restored = await importAllData(json);
    expect(restored).toEqual({ products: 1, sales: 1, stockLogs: 1 });
    expect((await db.products.get(id))?.stock).toBe(28);
  });
});
