
import { AlertTriangle, X } from 'lucide-react';

const StorageWarning: React.FC<{ percentage: number; onClose: () => void }> = ({ percentage, onClose }) => (
  <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 flex items-center justify-between z-50">
    <div className="flex items-center gap-2">
      <AlertTriangle size={20} />
      <span>Storage usage: {percentage.toFixed(1)}% - Consider removing old feeds</span>
    </div>
    <button onClick={onClose}>
      <X size={20} />
    </button>
  </div>
);

export default StorageWarning;