import { ArrowLeft } from 'lucide-react';
import { Item } from '../types/index';

const ArticleView: React.FC<{
  item: Item | null;
  onToggleRead: (item: Item) => void;
  onBack: () => void;
}> = ({ item, onToggleRead, onBack }) => {
  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center px-4">
          <p className="text-lg mb-2">No post selected</p>
          <p className="text-sm">Open a post in the list to the left</p>
          <p className="text-sm">to begin consuming feeds</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 border-b">
        <button
          onClick={onBack}
          className="flex md:hidden items-center gap-2 text-blue-500 mb-4 hover:text-blue-600"
        >
          <ArrowLeft size={20} />
          <span>Back to list</span>
        </button>
        <h1 className="text-xl md:text-2xl font-bold mb-3">{item.title}</h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-gray-500">
          <div>
            {item.author && <span>{item.author} · </span>}
            <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
          </div>
          <button
            onClick={() => onToggleRead(item)}
            className={`px-3 py-1 text-sm rounded whitespace-nowrap ${item.read ? 'bg-gray-200' : 'bg-blue-500 text-white'}`}
          >
            {item.read ? 'Mark Unread' : 'Mark Read'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div 
          className="prose prose-sm max-w-none mb-6"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
        
        <a 
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Read full article →
        </a>
      </div>
    </>
  );
};

export default ArticleView;