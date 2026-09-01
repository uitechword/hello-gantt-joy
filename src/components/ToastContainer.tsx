import { useToast } from '@/hooks/use-toast-simple';

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <div className="toast-title">{t.title}</div>
          {t.description && <div className="toast-desc">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}
