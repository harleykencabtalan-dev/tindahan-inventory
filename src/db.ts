import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from './firebase';
import {
  type Product,
  type Sale,
  type CartItem,
  type StockLog,
  type BusinessType,
  roundNum,
} from './types';

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

function productsCol(uid: string) {
  return collection(firestore, 'stores', uid, 'products');
}

function salesCol(uid: string) {
  return collection(firestore, 'stores', uid, 'sales');
}

function stockLogsCol(uid: string) {
  return collection(firestore, 'stores', uid, 'stockLogs');
}

export function buildSaleRecord(
  cart: CartItem[],
  cashReceived: number,
  source: BusinessType
): Omit<Sale, 'id'> {
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

  return {
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
}

export function subscribeProducts(uid: string, onData: (items: Product[]) => void) {
  const q = query(productsCol(uid), orderBy('name'));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
  });
}

export function subscribeSales(uid: string, onData: (items: Sale[]) => void) {
  const q = query(salesCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) })));
  });
}

export function subscribeStockLogs(uid: string, onData: (items: StockLog[]) => void) {
  const q = query(stockLogsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockLog, 'id'>) })));
  });
}

export async function ensureSeeded(uid: string): Promise<void> {
  const key = `tindahan_seeded_v2_${uid}`;
  if (localStorage.getItem(key)) return;
  const snap = await getDocs(productsCol(uid));
  if (snap.empty) {
    const batch = writeBatch(firestore);
    const now = Date.now();
    for (const p of SAMPLE_PRODUCTS) {
      const ref = doc(productsCol(uid));
      batch.set(ref, { ...p, updatedAt: now });
    }
    await batch.commit();
  }
  localStorage.setItem(key, '1');
}

export async function saveProduct(
  uid: string,
  payload: Omit<Product, 'id'>,
  existingId?: string
): Promise<void> {
  if (existingId) {
    await updateDoc(doc(firestore, 'stores', uid, 'products', existingId), payload);
  } else {
    await addDoc(productsCol(uid), payload);
  }
}

export async function deleteProduct(uid: string, productId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'stores', uid, 'products', productId));
}

export async function completeSaleTransaction(
  uid: string,
  cart: CartItem[],
  cashReceived: number,
  source: BusinessType
): Promise<Sale> {
  const saleRecord = buildSaleRecord(cart, cashReceived, source);
  const newSaleRef = doc(salesCol(uid));

  await runTransaction(firestore, async (tx) => {
    const prodSnapshots = await Promise.all(
      cart
        .filter((item) => item.product.id != null)
        .map(async (item) => {
          const ref = doc(firestore, 'stores', uid, 'products', item.product.id!);
          const snap = await tx.get(ref);
          return { ref, snap, qty: item.quantity };
        })
    );

    for (const { ref, snap, qty } of prodSnapshots) {
      if (snap.exists()) {
        const currentStock = Number(snap.data().stock ?? 0);
        const nextStock = Math.max(0, roundNum(currentStock - qty, 2));
        tx.update(ref, { stock: nextStock, updatedAt: Date.now() });
      }
    }

    tx.set(newSaleRef, saleRecord);
  });

  return { ...saleRecord, id: newSaleRef.id };
}

export async function restockProductTransaction(
  uid: string,
  product: Product,
  addQty: number
): Promise<void> {
  if (!product.id || isNaN(addQty) || addQty <= 0) return;
  const cleanAdd = roundNum(addQty, 2);
  const business: BusinessType =
    product.category === 'Rice' || product.unit === 'kg' ? 'rice' : 'sari-sari';

  const prodRef = doc(firestore, 'stores', uid, 'products', product.id);
  const logRef = doc(stockLogsCol(uid));

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(prodRef);
    if (!snap.exists()) return;
    const data = snap.data() as Omit<Product, 'id'>;
    tx.update(prodRef, {
      stock: roundNum((data.stock ?? 0) + cleanAdd, 2),
      updatedAt: Date.now(),
    });
    tx.set(logRef, {
      productId: product.id!,
      productName: data.name,
      business,
      unit: data.unit,
      quantityAdded: cleanAdd,
      createdAt: Date.now(),
    });
  });
}

export async function voidSaleTransaction(uid: string, saleId: string): Promise<void> {
  const saleRef = doc(firestore, 'stores', uid, 'sales', saleId);

  await runTransaction(firestore, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return;
    const sale = saleSnap.data() as Omit<Sale, 'id'>;
    if (sale.voided) return;

    const prodSnapshots = await Promise.all(
      sale.items.map(async (item) => {
        const ref = doc(firestore, 'stores', uid, 'products', String(item.productId));
        const snap = await tx.get(ref);
        return { ref, snap, qty: item.quantity };
      })
    );

    for (const { ref, snap, qty } of prodSnapshots) {
      if (snap.exists()) {
        const currentStock = Number(snap.data().stock ?? 0);
        tx.update(ref, {
          stock: roundNum(currentStock + qty, 2),
          updatedAt: Date.now(),
        });
      }
    }

    tx.update(saleRef, { voided: true });
  });
}

export async function exportAllData(uid: string): Promise<string> {
  const [prodSnap, salesSnap, logsSnap] = await Promise.all([
    getDocs(productsCol(uid)),
    getDocs(salesCol(uid)),
    getDocs(stockLogsCol(uid)),
  ]);

  const products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const stockLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return JSON.stringify(
    {
      app: 'TindahanInventory',
      version: 3,
      exportedAt: new Date().toISOString(),
      products,
      sales,
      stockLogs,
    },
    null,
    2
  );
}

export async function clearAllData(uid: string): Promise<void> {
  const [prodSnap, salesSnap, logsSnap] = await Promise.all([
    getDocs(productsCol(uid)),
    getDocs(salesCol(uid)),
    getDocs(stockLogsCol(uid)),
  ]);

  const allRefs = [...prodSnap.docs, ...salesSnap.docs, ...logsSnap.docs].map((d) => d.ref);
  for (let i = 0; i < allRefs.length; i += 450) {
    const batch = writeBatch(firestore);
    for (const ref of allRefs.slice(i, i + 450)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

export async function importAllData(
  uid: string,
  jsonText: string
): Promise<{ products: number; sales: number; stockLogs: number }> {
  const parsed = JSON.parse(jsonText);
  if (!parsed || !Array.isArray(parsed.products)) {
    throw new Error('Invalid backup file format.');
  }

  const products: Product[] = parsed.products;
  const sales: Sale[] = Array.isArray(parsed.sales) ? parsed.sales : [];
  const stockLogs: StockLog[] = Array.isArray(parsed.stockLogs) ? parsed.stockLogs : [];

  await clearAllData(uid);

  const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
  for (const p of products) {
    const { id, ...rest } = p;
    const ref = id ? doc(firestore, 'stores', uid, 'products', String(id)) : doc(productsCol(uid));
    ops.push({ ref, data: rest });
  }
  for (const s of sales) {
    const { id, ...rest } = s;
    const ref = id ? doc(firestore, 'stores', uid, 'sales', String(id)) : doc(salesCol(uid));
    ops.push({ ref, data: rest });
  }
  for (const l of stockLogs) {
    const { id, ...rest } = l;
    const ref = id ? doc(firestore, 'stores', uid, 'stockLogs', String(id)) : doc(stockLogsCol(uid));
    ops.push({ ref, data: rest });
  }

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(firestore);
    for (const op of ops.slice(i, i + 450)) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }

  return { products: products.length, sales: sales.length, stockLogs: stockLogs.length };
}
