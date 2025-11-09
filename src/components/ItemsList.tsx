import { RefreshCw } from 'lucide-react';

const ItemsList: React.FC<{
  items: Item[];
  selectedItem: Item | null;
  loading: boolean;
  error: string | null;
  title: string;
  getFeedTitle: (feedId: string) => string;
  onSelectItem: (item: Item) => void;
  onRefresh: () => void;
}> = ({ items, selectedItem, loading, error, title, getFeedTitle, onSelectItem, onRefresh }) => (
  <div className="w-96 bg-white border-r flex flex-col">
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded"
          title="Refresh all feeds"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-sm text-gray-500">{items.length} items</p>
    </div>
    
    {error && (
      <div className="bg-red-100 text-red-700 px-4 py-2 text-sm">
        {error}
      </div>
    )}
    
    <div className="flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <div className="text-center text-gray-500 mt-20 px-4">
          <p>No items to display</p>
        </div>
      ) : (
        items.map(item => (
          <div
            key={item.id}
            onClick={() => onSelectItem(item)}
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
);

export default ItemsList;