import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'yumyum_cart';

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.items && Array.isArray(parsed.items)) return parsed;
    }
  } catch {
    // corrupted data
  }
  return { items: [], locationId: null };
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items: state.items,
      locationId: state.locationId,
    }));
  } catch {
    // storage full or unavailable
  }
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const key = `${action.payload.item.id}-${JSON.stringify(action.payload.options || [])}`;
      const existing = state.items.find((i) => i.key === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + (action.payload.quantity || 1) } : i
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
        return {
          ...state,
          items: state.items.filter((i) => i.key !== action.payload.key),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.key === action.payload.key ? { ...i, quantity: action.payload.quantity } : i
        ),
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.key !== action.payload.key),
      };
    case 'SET_LOCATION':
      return { ...state, locationId: action.payload, items: [] };
    case 'CLEAR':
      return { ...state, items: [], locationId: null };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, null, loadFromStorage);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const addItem = useCallback((item, options, quantity) => {
    dispatch({ type: 'ADD_ITEM', payload: { item, options, quantity } });
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { key, quantity } });
  }, []);

  const removeItem = useCallback((key) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { key } });
  }, []);

  const setLocation = useCallback((locationId) => {
    dispatch({ type: 'SET_LOCATION', payload: locationId });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const total = state.items.reduce((sum, entry) => {
    const basePrice = entry.item.price * entry.quantity;
    const optionsPrice = entry.options.reduce(
      (s, opt) => s + (opt.price_modifier || 0),
      0
    ) * entry.quantity;
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

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
