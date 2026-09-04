/**
 * Simple unified LocalStorage manager for Such A Dragg.
 * Stores all app settings, preferences, and board passwords under 'dragg_app_store'.
 */

const STORAGE_KEY = 'dragg_app_store';

function getStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Error reading dragg_app_store:', err);
    return {};
  }
}

function saveStore(store) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('dragg-store-updated', { detail: store }));
  } catch (err) {
    console.error('Error writing dragg_app_store:', err);
  }
}

export const getDraggItem = (key, defaultValue = null) => {
  const store = getStore();
  return store[key] !== undefined ? store[key] : defaultValue;
};

export const setDraggItem = (key, value) => {
  const store = getStore();
  store[key] = value;
  saveStore(store);
};

export const removeDraggItem = (key) => {
  const store = getStore();
  delete store[key];
  saveStore(store);
};

export const getDraggBoardPass = (boardId) => {
  if (!boardId) return '';
  const store = getStore();
  return (store.boardPasswords && store.boardPasswords[boardId]) || '';
};

export const setDraggBoardPass = (boardId, passHash) => {
  if (!boardId) return;
  const store = getStore();
  if (!store.boardPasswords) store.boardPasswords = {};
  store.boardPasswords[boardId] = passHash;
  saveStore(store);
};

export const removeDraggBoardPass = (boardId) => {
  if (!boardId) return;
  const store = getStore();
  if (store.boardPasswords && store.boardPasswords[boardId]) {
    delete store.boardPasswords[boardId];
    saveStore(store);
  }
};
