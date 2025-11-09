export const checkStorageQuota = async (): Promise<{ used: number, total: number, percentage: number }> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const total = estimate.quota || 0;
    const percentage = total > 0 ? (used / total) * 100 : 0;
    return { used, total, percentage };
  }
  return { used: 0, total: 0, percentage: 0 };
};