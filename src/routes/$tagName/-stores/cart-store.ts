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

export interface MembershipPlan {
  id: string;
  title: string;
  price: number;
  numberOfBooks?: number; // Number of books allowed in the plan
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => Promise<void>;
  removeItem: (enrollInviteId: string) => Promise<void>;
  updateQuantity: (enrollInviteId: string, quantity: number) => Promise<void>;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemCountByMode: (mode: 'buy' | 'rent') => Promise<number>; // Get count for specific mode
  getItemByEnrollInviteId: (enrollInviteId: string) => CartItem | undefined;
  membershipPlan: MembershipPlan | null;
  setMembershipPlan: (plan: MembershipPlan | null) => void;
  syncCart: () => Promise<void>; // Sync cart with current mode
  getCartMode: () => 'buy' | 'rent';
}


const STORAGE_KEY_BUY = 'cart_items_buy';
const STORAGE_KEY_RENT = 'cart_items_rent';
const PLAN_STORAGE_KEY = 'cart_plan';

// Get current cart mode based on levelFilter
const getCartMode = (): 'buy' | 'rent' => {
  if (typeof window === 'undefined') return 'buy';
  const levelFilter = sessionStorage.getItem('levelFilter') || '';
  return levelFilter.includes('Rent') ? 'rent' : 'buy';
};

// Get storage key based on mode
const getStorageKey = (mode?: 'buy' | 'rent'): string => {
  const currentMode = mode || getCartMode();
  return currentMode === 'rent' ? STORAGE_KEY_RENT : STORAGE_KEY_BUY;
};

// Load cart from storage
const loadCartFromStorage = async (mode?: 'buy' | 'rent'): Promise<CartItem[]> => {
  try {
    const storageKey = getStorageKey(mode);
    const stored = await Preferences.get({ key: storageKey });
    if (stored.value) {
      return JSON.parse(stored.value);
    }
  } catch (error) {
    console.error('[CartStore] Error loading cart from storage:', error);
  }
  return [];
};

const loadPlanFromStorage = async (): Promise<MembershipPlan | null> => {
  try {
    const stored = await Preferences.get({ key: PLAN_STORAGE_KEY });
    if (stored.value) {
      return JSON.parse(stored.value);
    }
  } catch (error) {
    console.error('[CartStore] Error loading plan from storage:', error);
  }
  return null;
};

// Save cart to storage
const saveCartToStorage = async (items: CartItem[], mode?: 'buy' | 'rent') => {
  try {
    const storageKey = getStorageKey(mode);
    await Preferences.set({
      key: storageKey,
      value: JSON.stringify(items),
    });
  } catch (error) {
    console.error('[CartStore] Error saving cart to storage:', error);
  }
}

// Sync cart based on current mode
const syncCartWithMode = async () => {
  const mode = getCartMode();
  const items = await loadCartFromStorage(mode);
  useCartStore.setState({ items });
};


const savePlanToStorage = async (plan: MembershipPlan | null) => {
  try {
    await Preferences.set({
      key: PLAN_STORAGE_KEY,
      value: JSON.stringify(plan),
    });
  } catch (error) {
    console.error('[CartStore] Error saving plan to storage:', error);
  }
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  membershipPlan: null,

  getCartMode: () => getCartMode(),

  syncCart: async () => {
    await syncCartWithMode();
    // Dispatch event to notify components
    window.dispatchEvent(new CustomEvent('cartSynced'));
  },

  addItem: async (item) => {
    // Use enrollInviteId as the unique identifier
    if (!item.enrollInviteId) {
      console.error('[CartStore] Cannot add item without enrollInviteId');
      return;
    }

    const mode = getCartMode();
    
    // IMPORTANT: Load the correct cart for the current mode to ensure separation
    const currentItemsForMode = await loadCartFromStorage(mode);
    
    const existingItem = currentItemsForMode.find((i) => i.enrollInviteId === item.enrollInviteId);

    if (existingItem) {
      // For Buy mode: Update quantity if item already exists
      // For Rent mode: Don't allow duplicates (current behavior)
      if (mode === 'buy') {
        const updatedItems: CartItem[] = currentItemsForMode.map((i) =>
          i.enrollInviteId === item.enrollInviteId ? { ...i, quantity: i.quantity + 1 } : i
        );
        set({ items: updatedItems });
        await saveCartToStorage(updatedItems, mode);
      }
      // For Rent mode, if item exists, do nothing (no duplicate items)
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
      const newItems: CartItem[] = [...currentItemsForMode, newItem];
      set({ items: newItems });
      await saveCartToStorage(newItems, mode);
    }
  },

  removeItem: async (enrollInviteId) => {
    const mode = getCartMode();
    // Load the correct cart for the current mode
    const currentItemsForMode = await loadCartFromStorage(mode);
    const updatedItems = currentItemsForMode.filter((item) => item.enrollInviteId !== enrollInviteId);
    set({ items: updatedItems });
    await saveCartToStorage(updatedItems, mode);
  },

  updateQuantity: async (enrollInviteId, quantity) => {
    const mode = getCartMode();
    if (quantity <= 0) {
      await get().removeItem(enrollInviteId);
      return;
    }
    // Load the correct cart for the current mode
    const currentItemsForMode = await loadCartFromStorage(mode);
    const updatedItems = currentItemsForMode.map((item) =>
      item.enrollInviteId === enrollInviteId ? { ...item, quantity } : item
    );
    set({ items: updatedItems });
    await saveCartToStorage(updatedItems, mode);
  },

  clearCart: () => {
    const mode = getCartMode();
    set({ items: [] });
    saveCartToStorage([], mode);
    set({ membershipPlan: null });
    savePlanToStorage(null);
  },

  setMembershipPlan: (plan) => {
    set({ membershipPlan: plan });
    savePlanToStorage(plan);
  },

  getTotal: () => {
    const itemTotal = get().items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
    const planPrice = get().membershipPlan?.price || 0;
    return itemTotal + planPrice;
  },

  getItemCount: () => {
    // Get count from current store state (for current mode)
    return get().items.reduce((count, item) => count + item.quantity, 0);
  },

  getItemCountByMode: async (mode: 'buy' | 'rent') => {
    // Get count from storage for specific mode
    const items = await loadCartFromStorage(mode);
    return items.reduce((count, item) => count + item.quantity, 0);
  },
  
  getItemCountForCurrentMode: () => {
    // Get count from current store state (reactive, for current mode)
    const mode = getCartMode();
    // If store items match current mode, use them; otherwise return 0 (will be updated by sync)
    return get().items.reduce((count, item) => count + item.quantity, 0);
  },

  getItemByEnrollInviteId: (enrollInviteId) => {
    return get().items.find((item) => item.enrollInviteId === enrollInviteId);
  },
}));

// Initialize cart from storage on load
if (typeof window !== 'undefined') {
  syncCartWithMode();
  loadPlanFromStorage().then((plan) => {
    useCartStore.setState({ membershipPlan: plan });
  });

  // Listen for levelFilter changes to sync cart
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'levelFilter') {
      syncCartWithMode();
    }
  };
  window.addEventListener('storage', handleStorageChange);
  
  // Also listen for custom events (for same-tab changes)
  window.addEventListener('levelFilterChanged', () => {
    syncCartWithMode();
  });
}
