import { describe, it, expect } from 'vitest';
import { buildSaleRecord } from './db';
import {
  computeTopItems,
  computePeriodBreakdown,
  groupSalesByDate,
} from './utils/logAnalytics';
import {
  formatPeso,
  formatQty,
  getSaleSource,
  roundNum,
  splitRiceKg,
  type Product,
  type Sale,
} from './types';

describe('Helper Functions (Unit Tests)', () => {
  it('formats Philippine peso amounts cleanly', () => {
    expect(formatPeso(0)).toBe('₱0');
    expect(formatPeso(56)).toBe('₱56');
    expect(formatPeso(1250.5)).toBe('₱1,250.50');
  });

  it('formats rice kilos with sack equivalents at 25 kg per sack and splits sacks + extra kg', () => {
    expect(splitRiceKg(71)).toEqual({ sacks: 2, extraKg: 21 });
    expect(formatQty(10, 'kg')).toBe('10 kg');
    expect(formatQty(25, 'kg')).toBe('1 sack (25 kg)');
    expect(formatQty(50, 'kg')).toBe('2 sacks (50 kg)');
    expect(formatQty(71, 'kg')).toBe('2 sacks + 21 kg');
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
    expect(sale.total).toBe(155);
    expect(sale.totalCost).toBe(135);
    expect(sale.profit).toBe(20);
    expect(sale.change).toBe(45);
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

    expect(sale.total).toBe(76);
    expect(sale.totalCost).toBe(60);
    expect(sale.profit).toBe(16);
    expect(sale.change).toBe(0);
  });
});

describe('In-App Log Analytics (Unit Tests)', () => {
  const sampleSales: Sale[] = [
    {
      id: 's1',
      source: 'rice',
      items: [
        {
          productId: 'r1',
          name: 'Dinorado Rice',
          unit: 'kg',
          price: 62,
          costPrice: 54,
          quantity: 5,
          subtotal: 310,
          profit: 40,
        },
      ],
      total: 310,
      totalCost: 270,
      profit: 40,
      cashReceived: 350,
      change: 40,
      createdAt: new Date(2026, 10, 24, 9, 0).getTime(),
      voided: false,
    },
    {
      id: 's2',
      source: 'sari-sari',
      items: [
        {
          productId: 'c1',
          name: 'Coke Mismo',
          unit: 'bottle',
          price: 20,
          costPrice: 15,
          quantity: 3,
          subtotal: 60,
          profit: 15,
        },
      ],
      total: 60,
      totalCost: 45,
      profit: 15,
      cashReceived: 100,
      change: 40,
      createdAt: new Date(2026, 10, 23, 14, 0).getTime(),
      voided: false,
    },
    {
      id: 's3',
      source: 'sari-sari',
      items: [
        {
          productId: 'c1',
          name: 'Coke Mismo',
          unit: 'bottle',
          price: 20,
          costPrice: 15,
          quantity: 2,
          subtotal: 40,
          profit: 10,
        },
      ],
      total: 40,
      totalCost: 30,
      profit: 10,
      cashReceived: 50,
      change: 10,
      createdAt: new Date(2026, 10, 24, 15, 0).getTime(),
      voided: true, // Voided sale must be excluded from totals & top items
    },
  ];

  it('ranks top selling items by revenue and excludes voided sales', () => {
    const top = computeTopItems(sampleSales, new Map());
    expect(top).toHaveLength(2);
    expect(top[0].name).toBe('Dinorado Rice');
    expect(top[0].revenue).toBe(310);
    expect(top[0].profit).toBe(40);
    expect(top[1].name).toBe('Coke Mismo');
    expect(top[1].quantity).toBe(3); // Voided s3 excluded
  });

  it('groups sales by date with friendly labels and excludes voided revenue', () => {
    const now = new Date(2026, 10, 24, 18, 0);
    const groups = groupSalesByDate(sampleSales, now);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].totalRevenue).toBe(310); // s3 is voided
    expect(groups[1].label).toBe('Yesterday');
    expect(groups[1].totalRevenue).toBe(60);
  });

  it('builds daily breakdown buckets for weekly/monthly views', () => {
    const buckets = computePeriodBreakdown(sampleSales, 'weekly', (s) => s.profit ?? 0);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].key).toBe('2026-11-24');
    expect(buckets[0].revenue).toBe(310);
    expect(buckets[1].key).toBe('2026-11-23');
    expect(buckets[1].revenue).toBe(60);
  });
});
