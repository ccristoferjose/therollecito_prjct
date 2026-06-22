'use client';

import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'yumyum_cart';

// Structural shapes the cart needs. No index signature, so menu types
// (MenuItem / MenuItemOptionValue) with extra fields are assignable.
export interface CartItemOption {
  id?: number;
  name?: string;
  price_modifier?: number;
}
export interface CartMenuItem {
  id: number;
  name: string;
  price: number;
  image_url?: string | null;
}
export interface CartEntry {
  key: string;
  item: CartMenuItem;
  options: CartItemOption[];
  quantity: number;
}
interface CartState {
  items: CartEntry[];
  locationId: number | null;
}

type CartAction =
  | { type: 'HYDRATE'; payload: CartState }
  | { type: 'ADD_ITEM'; payload: { item: CartMenuItem; options?: CartItemOption[]; quantity?: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { key: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { key: string } }
  | { type: 'SET_LOCATION'; payload: number | null }
  | { type: 'CLEAR' };

const initialState: CartState = { items: [], locationId: null };

function saveToStorage(state: CartState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items: state.items, locationId: state.locationId }),
    );
  } catch {
    // storage full / unavailable
  }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;
    case 'ADD_ITEM': {
      const key = `${action.payload.item.id}-${JSON.stringify(action.payload.options || [])}`;
      const existing = state.items.find((i) => i.key === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + (action.payload.quantity || 1) } : i,
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            key,
            item: action.payload.item,
            options: action.payload.options || [],
            quantity: action.payload.quantity || 1,
          },
        ],
      };
    }
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.key !== action.payload.key) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.key === action.payload.key ? { ...i, quantity: action.payload.quantity } : i,
        ),
      };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.key !== action.payload.key) };
    case 'SET_LOCATION':
      return { ...state, locationId: action.payload, items: [] };
    case 'CLEAR':
      return { ...state, items: [], locationId: null };
    default:
      return state;
  }
}

interface CartContextValue extends CartState {
  total: number;
  itemCount: number;
  addItem: (item: CartMenuItem, options?: CartItemOption[], quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  setLocation: (locationId: number | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CartState>;
        if (Array.isArray(parsed.items)) {
          dispatch({
            type: 'HYDRATE',
            payload: { items: parsed.items, locationId: parsed.locationId ?? null },
          });
        }
      }
    } catch {
      // corrupted data — keep empty cart
    }
  }, []);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const addItem = useCallback(
    (item: CartMenuItem, options?: CartItemOption[], quantity?: number) =>
      dispatch({ type: 'ADD_ITEM', payload: { item, options, quantity } }),
    [],
  );
  const updateQuantity = useCallback(
    (key: string, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', payload: { key, quantity } }),
    [],
  );
  const removeItem = useCallback((key: string) => dispatch({ type: 'REMOVE_ITEM', payload: { key } }), []);
  const setLocation = useCallback(
    (locationId: number | null) => dispatch({ type: 'SET_LOCATION', payload: locationId }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const total = state.items.reduce((sum, entry) => {
    const basePrice = entry.item.price * entry.quantity;
    const optionsPrice =
      entry.options.reduce((s, opt) => s + (opt.price_modifier || 0), 0) * entry.quantity;
    return sum + basePrice + optionsPrice;
  }, 0);

  return (
    <CartContext.Provider
      value={{ ...state, total, itemCount, addItem, updateQuantity, removeItem, setLocation, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
