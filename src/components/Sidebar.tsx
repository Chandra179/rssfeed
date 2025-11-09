
import { Plus, Upload, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const Sidebar: React.FC<{
  collapsed: boolean;
  onToggleCollapse: () => void;
  feeds: Feed[];
  allItems: Item[];
  selectedFeedFilter: string | null;
  showUnreadOnly: boolean;
  onSelectFilter: (feedId: string | null, unreadOnly: boolean) => void;
  onAddFeed: () => void;
  onImportOPML: () => void;
}> = ({ collapsed, onToggleCollapse, feeds, allItems, selectedFeedFilter, showUnreadOnly, onSelectFilter, onAddFeed, onImportOPML }) => (
  <div className={`bg-white border-r transition-all duration-300 ${collapsed ? 'w-12' : 'w-64'} flex flex-col`}>
    <div className="p-4 border-b flex items-center justify-between">
      {!collapsed && <h1 className="text-xl font-bold">RSS Reader</h1>}
      <button onClick={onToggleCollapse} className="p-1 hover:bg-gray-100 rounded">
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>
    
    {!collapsed && (
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
);

export default Sidebar;