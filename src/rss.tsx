import React, { useState, useEffect, useRef } from 'react';
import StorageWarning from './components/StorageWarning';
import Sidebar from './components/Sidebar';
import AddFeedForm from './components/AddFeedForm';
import ItemsList from './components/ItemsList';
import ArticleView from './components/ArticleView';
import { loadFeeds, loadAllItems, checkDuplicateHash, saveFeeds, saveItems, updateItem } from './services/database';
import { fetchFeed } from './services/feedService';
import { checkStorageQuota } from './services/storageService';
import { parseOPML } from './utils/opml';
import { generateHash } from './utils/hash';
import { Feed, Item } from './types/index';

const RSSReader: React.FC = () => {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedFeedFilter, setSelectedFeedFilter] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showArticleView, setShowArticleView] = useState(false);
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

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setShowArticleView(true);
  };

  const handleBackToList = () => {
    setShowArticleView(false);
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

  const handleSelectFilter = (feedId: string | null, unreadOnly: boolean) => {
    setSelectedFeedFilter(feedId);
    setShowUnreadOnly(unreadOnly);
  };

  const getListTitle = () => {
    if (selectedFeedFilter) return getFeedTitle(selectedFeedFilter);
    if (showUnreadOnly) return 'Unread';
    return 'All posts';
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {storageWarning.show && (
        <StorageWarning 
          percentage={storageWarning.percentage}
          onClose={() => setStorageWarning({ ...storageWarning, show: false })}
        />
      )}
      
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        feeds={feeds}
        allItems={allItems}
        selectedFeedFilter={selectedFeedFilter}
        showUnreadOnly={showUnreadOnly}
        onSelectFilter={handleSelectFilter}
        onAddFeed={() => setShowAddFeed(!showAddFeed)}
        onImportOPML={() => fileInputRef.current?.click()}
      />
      
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".opml,.xml" 
        className="hidden" 
        onChange={handleOPMLUpload}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Items List - Hidden on mobile when article is shown */}
        <div className={`flex flex-col ${showArticleView ? 'hidden md:flex' : 'flex'}`}>
          {sidebarOpen && showAddFeed && (
            <AddFeedForm
              url={newFeedUrl}
              loading={loading}
              onChange={setNewFeedUrl}
              onSubmit={() => {}}
            />
          )}
          
          <ItemsList
            items={filteredItems}
            selectedItem={selectedItem}
            loading={loading}
            error={error}
            title={getListTitle()}
            getFeedTitle={getFeedTitle}
            onSelectItem={handleSelectItem}
            onRefresh={refreshAllFeeds}
            onToggleSidebar={() => setSidebarOpen(true)}
          />
        </div>
        
        {/* Article View - Full screen on mobile when shown, always visible on desktop */}
        <div className={`flex-1 flex flex-col bg-white ${showArticleView ? 'flex' : 'hidden md:flex'}`}>
          <ArticleView
            item={selectedItem}
            onToggleRead={toggleRead}
            onBack={handleBackToList}
          />
        </div>
      </div>
    </div>
  );
};

// Load DOMPurify from CDN
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
document.head.appendChild(script);

export default RSSReader;