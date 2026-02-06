import { useNotifications } from '../lib/notifications';

export function NotificationCenter() {
  const { notifications, removeNotification } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '!';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/90';
      case 'error':
        return 'bg-red-500/90';
      case 'warning':
        return 'bg-amber-500/90';
      case 'info':
      default:
        return 'bg-blue-500/90';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex flex-col gap-2 p-4 max-w-md mx-auto pointer-events-auto">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`${getBgColor(notification.type)} text-white rounded-lg px-4 py-3 shadow-lg animate-fade-in flex items-start gap-3`}
            role="alert"
          >
            <span className="text-lg font-bold flex-shrink-0">{getIcon(notification.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{notification.title}</p>
              <p className="text-sm opacity-95">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-xl opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
