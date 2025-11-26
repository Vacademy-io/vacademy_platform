import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  level?: string;
  packageSessionId?: string;
  enrollInviteId?: string;
  levelId?: string;
  courseId?: string;
  [key: string]: any; // Allow additional fields
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (enrollInviteId: string) => void;
  updateQuantity: (enrollInviteId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemByEnrollInviteId: (enrollInviteId: string) => CartItem | undefined;
}

const STORAGE_KEY = 'cart_items';

// Load cart from storage
const loadCartFromStorage = async (): Promise<CartItem[]> => {
  try {
    const stored = await Preferences.get({ key: STORAGE_KEY });
    if (stored.value) {
      return JSON.parse(stored.value);
    }
  } catch (error) {
    console.error('[CartStore] Error loading cart from storage:', error);
  }
  return [];
};

// Save cart to storage
const saveCartToStorage = async (items: CartItem[]) => {
  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(items),
    });
  } catch (error) {
    console.error('[CartStore] Error saving cart to storage:', error);
  }
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) => {
    // Use enrollInviteId as the unique identifier
    if (!item.enrollInviteId) {
      console.error('[CartStore] Cannot add item without enrollInviteId');
      return;
    }

    const currentItems = get().items;
    const existingItem = currentItems.find((i) => i.enrollInviteId === item.enrollInviteId);

    if (existingItem) {
      // Update quantity if item already exists
      const updatedItems: CartItem[] = currentItems.map((i) =>
        i.enrollInviteId === item.enrollInviteId ? { ...i, quantity: i.quantity + 1 } : i
      );
      set({ items: updatedItems });
      saveCartToStorage(updatedItems);
    } else {
      // Add new item with quantity 1
      const newItem: CartItem = {
        id: item.id,
        title: item.title,
        price: item.price,
        quantity: 1,
        image: item.image,
        level: item.level,
        packageSessionId: item.packageSessionId,
        enrollInviteId: item.enrollInviteId,
        levelId: item.levelId,
        courseId: item.courseId,
        ...item, // Include any additional fields
      };
      const newItems: CartItem[] = [...currentItems, newItem];
      set({ items: newItems });
      saveCartToStorage(newItems);
    }
  },

  removeItem: (enrollInviteId) => {
    const updatedItems = get().items.filter((item) => item.enrollInviteId !== enrollInviteId);
    set({ items: updatedItems });
    saveCartToStorage(updatedItems);
  },

  updateQuantity: (enrollInviteId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(enrollInviteId);
      return;
    }
    const updatedItems = get().items.map((item) =>
      item.enrollInviteId === enrollInviteId ? { ...item, quantity } : item
    );
    set({ items: updatedItems });
    saveCartToStorage(updatedItems);
  },

  clearCart: () => {
    set({ items: [] });
    saveCartToStorage([]);
  },

  getTotal: () => {
    return get().items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0);
  },

  getItemByEnrollInviteId: (enrollInviteId) => {
    return get().items.find((item) => item.enrollInviteId === enrollInviteId);
  },
}));

// Initialize cart from storage on load
if (typeof window !== 'undefined') {
  loadCartFromStorage().then((items) => {
    useCartStore.setState({ items });
  });
}
