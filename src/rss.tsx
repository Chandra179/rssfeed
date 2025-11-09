import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Plus, Upload, ChevronLeft, ChevronRight, AlertTriangle, X, Filter } from 'lucide-react';
import DOMPurify from 'dompurify';

// Types
interface Feed {
  id: string;
  url: string;
  title: string;
  description: string;
  lastFetchedAt: number;
  lastFetchStatus: 'success' | 'cors_error' | 'not_found' | 'malformed_xml' | 'timeout';
  lastFetchError: string | null;
  totalSizeBytes: number;
  settings: {
    fetchImages: boolean;
    maxSizeBytes: number;
  };
}

interface Item {
  id: string;
  feedId: string;
  title: string;
  link: string;
  publishedAt: number;
  content: string;
  read: boolean;
  contentHash: string;
  author?: string;
  sizeBytes: number;
}

// IndexedDB setup
const DB_NAME = 'rss_reader';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
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

// Storage helpers
const saveFeeds = async (feeds: Feed[]): Promise<void> => {
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

const loadFeeds = async (): Promise<Feed[]> => {
  const db = await openDB();
  const tx = db.transaction('feeds', 'readonly');
  const store = tx.objectStore('feeds');
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveItems = async (items: Item[]): Promise<void> => {
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

const loadAllItems = async (): Promise<Item[]> => {
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

const loadItemsByFeed = async (feedId: string): Promise<Item[]> => {
  const db = await openDB();
  const tx = db.transaction('items', 'readonly');
  const store = tx.objectStore('items');
  const index = store.index('feedId');
  const request = index.getAll(feedId);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const items = request.result;
      resolve(items.sort((a, b) => b.publishedAt - a.publishedAt));
    };
    request.onerror = () => reject(request.error);
  });
};

const checkDuplicateHash = async (contentHash: string): Promise<boolean> => {
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

const updateItem = async (item: Item): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('items', 'readwrite');
  const store = tx.objectStore('items');
  store.put(item);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Utility functions
const generateHash = async (text: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const calculateSize = (obj: any): number => {
  return new Blob([JSON.stringify(obj)]).size;
};

const sanitizeHTML = (html: string, fetchImages: boolean): string => {
  const config: any = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    RETURN_TRUSTED_TYPE: false
  };
  
  if (fetchImages) {
    config.ALLOWED_TAGS.push('img');
    config.ALLOWED_ATTR.push('src', 'alt');
  }
  
  return DOMPurify.sanitize(html, config) as unknown as string;
};

const parseOPML = (xmlText: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const outlines = doc.querySelectorAll('outline[xmlUrl], outline[xmlurl]');
  const urls: string[] = [];
  
  outlines.forEach(outline => {
    const url = outline.getAttribute('xmlUrl') || outline.getAttribute('xmlurl');
    if (url && url.startsWith('https://')) {
      urls.push(url);
    }
  });
  
  return urls;
};

const fetchFeed = async (url: string, fetchImages: boolean): Promise<{ feed: Partial<Feed>, items: Partial<Item>[] }> => {
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS feeds are supported');
  }
  
  const response = await fetch(url, { mode: 'cors' });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('not_found');
    }
    throw new Error(`HTTP ${response.status}`);
  }
  
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  
  if (doc.querySelector('parsererror')) {
    throw new Error('malformed_xml');
  }
  
  const channel = doc.querySelector('channel, feed');
  if (!channel) {
    throw new Error('malformed_xml');
  }
  
  const feedTitle = channel.querySelector('title')?.textContent || 'Untitled Feed';
  const feedDescription = channel.querySelector('description, subtitle')?.textContent || '';
  
  const itemElements = Array.from(doc.querySelectorAll('item, entry'));
  const items: Partial<Item>[] = [];
  
  for (const itemEl of itemElements) {
    const title = itemEl.querySelector('title')?.textContent || 'Untitled';
    const link = itemEl.querySelector('link')?.textContent || 
                 itemEl.querySelector('link')?.getAttribute('href') || '';
    const pubDate = itemEl.querySelector('pubDate, published, updated')?.textContent || '';
    const content = itemEl.querySelector('content\\:encoded, content, description, summary')?.textContent || '';
    const author = itemEl.querySelector('author, creator, dc\\:creator')?.textContent || undefined;
    
    const sanitized = sanitizeHTML(content, fetchImages);
    const contentHash = await generateHash(link + title);
    
    const item: Partial<Item> = {
      title,
      link,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      content: sanitized,
      contentHash,
      author,
      read: false
    };
    
    item.sizeBytes = calculateSize(item);
    items.push(item);
  }
  
  return {
    feed: {
      title: feedTitle,
      description: feedDescription
    },
    items
  };
};

const checkStorageQuota = async (): Promise<{ used: number, total: number, percentage: number }> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const total = estimate.quota || 0;
    const percentage = total > 0 ? (used / total) * 100 : 0;
    return { used, total, percentage };
  }
  return { used: 0, total: 0, percentage: 0 };
};

// Main component
const RSSReader: React.FC = () => {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedFeedFilter, setSelectedFeedFilter] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<{ show: boolean, percentage: number }>({ show: false, percentage: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFeeds().then(setFeeds);
    loadAllItems().then(items => {
      setAllItems(items);
      setFilteredItems(items);
    });
    checkStorage();
  }, []);

  useEffect(() => {
    let filtered = allItems;
    
    if (selectedFeedFilter) {
      filtered = filtered.filter(item => item.feedId === selectedFeedFilter);
    }
    
    if (showUnreadOnly) {
      filtered = filtered.filter(item => !item.read);
    }
    
    setFilteredItems(filtered);
  }, [allItems, selectedFeedFilter, showUnreadOnly]);

  const checkStorage = async () => {
    const quota = await checkStorageQuota();
    if (quota.percentage >= 80) {
      setStorageWarning({ show: true, percentage: quota.percentage });
    }
  };

  const getFeedTitle = (feedId: string): string => {
    const feed = feeds.find(f => f.id === feedId);
    return feed?.title || 'Unknown Feed';
  };

  const addFeed = async (url: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const feedId = await generateHash(url);
      
      if (feeds.find(f => f.id === feedId)) {
        setError('Feed already exists');
        return;
      }
      
      const { feed: feedData, items: feedItems } = await fetchFeed(url, false);
      
      const newFeed: Feed = {
        id: feedId,
        url,
        title: feedData.title || 'Untitled Feed',
        description: feedData.description || '',
        lastFetchedAt: Date.now(),
        lastFetchStatus: 'success',
        lastFetchError: null,
        totalSizeBytes: 0,
        settings: {
          fetchImages: false,
          maxSizeBytes: 7 * 1024 * 1024
        }
      };
      
      const newItems: Item[] = [];
      let totalSize = 0;
      
      for (const item of feedItems) {
        const isDuplicate = await checkDuplicateHash(item.contentHash!);
        if (!isDuplicate) {
          const itemId = await generateHash(item.link! + item.title!);
          const fullItem: Item = {
            id: itemId,
            feedId,
            title: item.title!,
            link: item.link!,
            publishedAt: item.publishedAt!,
            content: item.content!,
            read: false,
            contentHash: item.contentHash!,
            author: item.author,
            sizeBytes: item.sizeBytes!
          };
          
          totalSize += fullItem.sizeBytes;
          
          if (totalSize > newFeed.settings.maxSizeBytes) {
            setError(`Feed exceeds 7MB limit. Loaded partial content.`);
            break;
          }
          
          newItems.push(fullItem);
        }
      }
      
      newFeed.totalSizeBytes = totalSize;
      
      await saveFeeds([newFeed]);
      await saveItems(newItems);
      
      setFeeds([...feeds, newFeed]);
      const updatedItems = await loadAllItems();
      setAllItems(updatedItems);
      
      setNewFeedUrl('');
      setShowAddFeed(false);
      await checkStorage();
    } catch (err: any) {
      if (err.message === 'not_found') {
        setError('Feed not found (404)');
      } else if (err.message === 'malformed_xml') {
        setError('Invalid RSS/Atom feed format');
      } else if (err.name === 'TypeError') {
        setError('CORS error: Cannot access feed');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshAllFeeds = async () => {
    setLoading(true);
    for (const feed of feeds) {
      await refreshFeed(feed);
    }
    const updatedItems = await loadAllItems();
    setAllItems(updatedItems);
    setLoading(false);
  };

  const refreshFeed = async (feed: Feed) => {
    try {
      const { feed: feedData, items: feedItems } = await fetchFeed(feed.url, feed.settings.fetchImages);
      
      const updatedFeed = { ...feed };
      updatedFeed.title = feedData.title || feed.title;
      updatedFeed.description = feedData.description || feed.description;
      updatedFeed.lastFetchedAt = Date.now();
      updatedFeed.lastFetchStatus = 'success';
      updatedFeed.lastFetchError = null;
      
      const newItems: Item[] = [];
      let totalSize = feed.totalSizeBytes;
      
      for (const item of feedItems) {
        const isDuplicate = await checkDuplicateHash(item.contentHash!);
        if (!isDuplicate) {
          const itemId = await generateHash(item.link! + item.title!);
          const fullItem: Item = {
            id: itemId,
            feedId: feed.id,
            title: item.title!,
            link: item.link!,
            publishedAt: item.publishedAt!,
            content: item.content!,
            read: false,
            contentHash: item.contentHash!,
            author: item.author,
            sizeBytes: item.sizeBytes!
          };
          
          totalSize += fullItem.sizeBytes;
          
          if (totalSize > feed.settings.maxSizeBytes) {
            break;
          }
          
          newItems.push(fullItem);
        }
      }
      
      updatedFeed.totalSizeBytes = totalSize;
      
      await saveFeeds([updatedFeed]);
      if (newItems.length > 0) {
        await saveItems(newItems);
      }
      
      setFeeds(feeds.map(f => f.id === feed.id ? updatedFeed : f));
      
      await checkStorage();
    } catch (err: any) {
      const updatedFeed = { ...feed };
      updatedFeed.lastFetchedAt = Date.now();
      
      if (err.message === 'not_found') {
        updatedFeed.lastFetchStatus = 'not_found';
        updatedFeed.lastFetchError = 'Feed not found (404)';
      } else if (err.message === 'malformed_xml') {
        updatedFeed.lastFetchStatus = 'malformed_xml';
        updatedFeed.lastFetchError = 'Invalid RSS/Atom format';
      } else if (err.name === 'TypeError') {
        updatedFeed.lastFetchStatus = 'cors_error';
        updatedFeed.lastFetchError = 'CORS error';
      } else {
        updatedFeed.lastFetchStatus = 'timeout';
        updatedFeed.lastFetchError = err.message;
      }
      
      await saveFeeds([updatedFeed]);
      setFeeds(feeds.map(f => f.id === feed.id ? updatedFeed : f));
    }
  };

  const handleOPMLUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const urls = parseOPML(text);
      
      for (const url of urls) {
        await addFeed(url);
      }
    } catch (err: any) {
      setError('Failed to parse OPML file');
    }
  };

  const toggleRead = async (item: Item) => {
    const updated = { ...item, read: !item.read };
    await updateItem(updated);
    setAllItems(allItems.map(i => i.id === item.id ? updated : i));
    if (selectedItem?.id === item.id) {
      setSelectedItem(updated);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {storageWarning.show && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span>Storage usage: {storageWarning.percentage.toFixed(1)}% - Consider removing old feeds</span>
          </div>
          <button onClick={() => setStorageWarning({ ...storageWarning, show: false })}>
            <X size={20} />
          </button>
        </div>
      )}
      
      {/* Left Sidebar - Feed List */}
      <div className={`bg-white border-r transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-64'} flex flex-col`}>
        <div className="p-4 border-b flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-xl font-bold">RSS Reader</h1>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 hover:bg-gray-100 rounded">
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        {!sidebarCollapsed && (
          <>
            <div className="p-4 border-b flex gap-2">
              <button 
                onClick={() => setShowAddFeed(!showAddFeed)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <Plus size={16} />
                Add Feed
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                title="Import OPML"
              >
                <Upload size={16} />
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".opml,.xml" 
                className="hidden" 
                onChange={handleOPMLUpload}
              />
            </div>
            
            {showAddFeed && (
              <div className="p-4 border-b bg-gray-50">
                <input 
                  type="text"
                  placeholder="https://example.com/feed.xml"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded mb-2"
                />
                <button 
                  onClick={() => addFeed(newFeedUrl)}
                  disabled={loading || !newFeedUrl}
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {loading ? 'Adding...' : 'Add'}
                </button>
              </div>
            )}

            <div className="p-4 border-b">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={16} />
                <span className="font-semibold text-sm">Filters</span>
              </div>
              <button
                onClick={() => {
                  setSelectedFeedFilter(null);
                  setShowUnreadOnly(false);
                }}
                className={`w-full text-left px-3 py-2 rounded mb-1 ${!selectedFeedFilter && !showUnreadOnly ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                All posts
              </button>
              <button
                onClick={() => {
                  setSelectedFeedFilter(null);
                  setShowUnreadOnly(true);
                }}
                className={`w-full text-left px-3 py-2 rounded ${!selectedFeedFilter && showUnreadOnly ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                Unread
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Feeds</p>
                {feeds.map(feed => {
                  const feedItemCount = allItems.filter(item => item.feedId === feed.id).length;
                  return (
                    <button
                      key={feed.id}
                      onClick={() => setSelectedFeedFilter(feed.id)}
                      className={`w-full text-left px-3 py-2 rounded mb-1 ${selectedFeedFilter === feed.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate flex-1">{feed.title}</span>
                        <span className="text-xs text-gray-500 ml-2">{feedItemCount}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Middle Panel - Items List */}
      <div className="w-96 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">
              {selectedFeedFilter ? getFeedTitle(selectedFeedFilter) : showUnreadOnly ? 'Unread' : 'All posts'}
            </h2>
            <button
              onClick={refreshAllFeeds}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded"
              title="Refresh all feeds"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <p className="text-sm text-gray-500">{filteredItems.length} items</p>
        </div>
        
        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="text-center text-gray-500 mt-20 px-4">
              <p>No items to display</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedItem?.id === item.id ? 'bg-blue-50' : ''} ${item.read ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1 line-clamp-2">{item.title}</h3>
                    <p className="text-xs text-gray-500">
                      {getFeedTitle(item.feedId)} · {new Date(item.publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!item.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Right Panel - Article Content */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedItem ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No post selected</p>
              <p className="text-sm">Open a post in the bar to the left</p>
              <p className="text-sm">to begin consuming feeds</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b">
              <h1 className="text-2xl font-bold mb-3">{selectedItem.title}</h1>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div>
                  {selectedItem.author && <span>{selectedItem.author} · </span>}
                  <span>{new Date(selectedItem.publishedAt).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => toggleRead(selectedItem)}
                  className={`px-3 py-1 text-sm rounded ${selectedItem.read ? 'bg-gray-200' : 'bg-blue-500 text-white'}`}
                >
                  {selectedItem.read ? 'Mark Unread' : 'Mark Read'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-sm max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: selectedItem.content }}
              />
              
              <a 
                href={selectedItem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Read full article →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RSSReader;