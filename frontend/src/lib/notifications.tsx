import { ReactNode, createContext, useContext, useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  onAction?: () => void;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (title: string, message: string, type: NotificationType) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (title: string, message: string, type: NotificationType = 'info') => {
      const id = `${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        title,
        message,
        type,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [notification, ...prev]);

      // Auto-remove after 5 seconds
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, 5000);

      return () => clearTimeout(timeout);
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
