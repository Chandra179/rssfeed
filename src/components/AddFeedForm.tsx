const AddFeedForm: React.FC<{
  url: string;
  loading: boolean;
  onChange: (url: string) => void;
  onSubmit: () => void;
}> = ({ url, loading, onChange, onSubmit }) => (
  <div className="p-4 border-b bg-gray-50">
    <input 
      type="text"
      placeholder="https://example.com/feed.xml"
      value={url}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border rounded mb-2"
    />
    <button 
      onClick={onSubmit}
      disabled={loading || !url}
      className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
    >
      {loading ? 'Adding...' : 'Add'}
    </button>
  </div>
);

export default AddFeedForm;