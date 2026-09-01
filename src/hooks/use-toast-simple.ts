import { useState, useCallback } from 'react';

interface ToastData {
  id: number;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;

const toastListeners: Set<(toast: ToastData) => void> = new Set();

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((t: ToastData) => {
    setToasts(prev => [...prev, t]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id));
    }, 3000);
  }, []);

  // Register listener on first call
  useState(() => {
    toastListeners.add(addToast);
    return () => { toastListeners.delete(addToast); };
  });

  const toast = useCallback((opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
    const t: ToastData = { ...opts, id: ++toastId };
    // Notify all listeners
    toastListeners.forEach(fn => fn(t));
  }, []);

  return { toast, toasts };
}
