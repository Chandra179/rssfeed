const DB_NAME = 'rss_reader';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('feeds')) {
        db.createObjectStore('feeds', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('feedId', 'feedId', { unique: false });
        itemStore.createIndex('publishedAt', 'publishedAt', { unique: false });
        itemStore.createIndex('contentHash', 'contentHash', { unique: false });
      }
    };
  });
};

export const saveFeeds = async (feeds: Feed[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('feeds', 'readwrite');
  const store = tx.objectStore('feeds');
  
  for (const feed of feeds) {
    store.put(feed);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadFeeds = async (): Promise<Feed[]> => {
  const db = await openDB();
  const tx = db.transaction('feeds', 'readonly');
  const store = tx.objectStore('feeds');
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveItems = async (items: Item[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  
  for (const item of items) {
    store.put(item);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadAllItems = async (): Promise<Item[]> => {
  const db = await openDB();
  const tx = db.transaction('items', 'readonly');
  const store = tx.objectStore('items');
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const items = request.result;
      resolve(items.sort((a, b) => b.publishedAt - a.publishedAt));
    };
    request.onerror = () => reject(request.error);
  });
};

export const checkDuplicateHash = async (contentHash: string): Promise<boolean> => {
  const db = await openDB();
  const tx = db.transaction('items', 'readonly');
  const store = tx.objectStore('items');
  const index = store.index('contentHash');
  const request = index.get(contentHash);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
};

export const updateItem = async (item: Item): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  store.put(item);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};