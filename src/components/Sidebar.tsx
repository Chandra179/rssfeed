
import { Plus, Upload, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Feed, Item } from '../types/index';

const Sidebar: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  feeds: Feed[];
  allItems: Item[];
  selectedFeedFilter: string | null;
  showUnreadOnly: boolean;
  onSelectFilter: (feedId: string | null, unreadOnly: boolean) => void;
  onAddFeed: () => void;
  onImportOPML: () => void;
}> = ({ isOpen, onToggle, feeds, allItems, selectedFeedFilter, showUnreadOnly, onSelectFilter, onAddFeed, onImportOPML }) => (
  <>
    {/* Mobile Overlay */}
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onToggle}
    />
    
    {/* Sidebar */}
    <div className={`
      fixed md:relative inset-y-0 left-0 z-50
      bg-white border-r flex flex-col
      transition-transform duration-300
      ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-12'}
    `}>
      <div className="p-4 border-b flex items-center justify-between">
        {isOpen && <h1 className="text-xl font-bold">RSS Reader</h1>}
        <button onClick={onToggle} className="p-1 hover:bg-gray-100 rounded">
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      
      {isOpen && (
        <>
          <div className="p-4 border-b flex gap-2">
            <button 
              onClick={onAddFeed}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Plus size={16} />
              Add Feed
            </button>
            <button 
              onClick={onImportOPML}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              title="Import OPML"
            >
              <Upload size={16} />
            </button>
          </div>
          
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} />
              <span className="font-semibold text-sm">Filters</span>
            </div>
            <button
              onClick={() => onSelectFilter(null, false)}
              className={`w-full text-left px-3 py-2 rounded mb-1 ${!selectedFeedFilter && !showUnreadOnly ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
            >
              All posts
            </button>
            <button
              onClick={() => onSelectFilter(null, true)}
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
                    onClick={() => onSelectFilter(feed.id, false)}
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
  </>
);

export default Sidebar;