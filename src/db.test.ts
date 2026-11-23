import { describe, it, expect } from 'vitest';
import { buildSaleRecord } from './db';
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
        items: [{ productId: '1', name: 'Dinorado', unit: 'kg', price: 62, quantity: 2, subtotal: 124 }],
        total: 124,
        cashReceived: 150,
        change: 26,
        createdAt: Date.now(),
      })
    ).toBe('rice');

    expect(
      getSaleSource({
        items: [{ productId: '2', name: 'Coke', unit: 'bottle', price: 20, quantity: 1, subtotal: 20 }],
        total: 20,
        cashReceived: 20,
        change: 0,
        createdAt: Date.now(),
      })
    ).toBe('sari-sari');
  });
});

describe('Sale & Profit Calculation (Unit Tests)', () => {
  it('computes rice decimal totals, cost, profit, and sukli accurately', () => {
    const rice: Product = {
      id: 'rice-1',
      name: 'Dinorado Rice',
      category: 'Rice',
      unit: 'kg',
      price: 62,
      costPrice: 54,
      stock: 50,
      lowStockThreshold: 15,
      updatedAt: Date.now(),
    };

    const sale = buildSaleRecord([{ product: rice, quantity: 2.5 }], 200, 'rice');

    expect(sale.source).toBe('rice');
    expect(sale.total).toBe(155);      // 62 * 2.5
    expect(sale.totalCost).toBe(135);  // 54 * 2.5
    expect(sale.profit).toBe(20);      // 155 - 135
    expect(sale.change).toBe(45);      // 200 - 155
    expect(sale.voided).toBe(false);
    expect(sale.items[0].profit).toBe(20);
  });

  it('computes mixed sari-sari cart totals and zero change for exact payment', () => {
    const coke: Product = {
      id: 'coke-1',
      name: 'Coke Mismo',
      category: 'Drinks',
      unit: 'bottle',
      price: 20,
      costPrice: 15,
      stock: 24,
      lowStockThreshold: 6,
      updatedAt: Date.now(),
    };
    const eggs: Product = {
      id: 'egg-1',
      name: 'Eggs',
      category: 'Sari-Sari',
      unit: 'pc',
      price: 9,
      costPrice: 7.5,
      stock: 30,
      lowStockThreshold: 10,
      updatedAt: Date.now(),
    };

    const sale = buildSaleRecord(
      [
        { product: coke, quantity: 2 },
        { product: eggs, quantity: 4 },
      ],
      76,
      'sari-sari'
    );

    expect(sale.total).toBe(76);      // 40 + 36
    expect(sale.totalCost).toBe(60);  // 30 + 30
    expect(sale.profit).toBe(16);
    expect(sale.change).toBe(0);
  });
});
