import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Calendar, CheckCheck, Trash2, ArrowLeft } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_match':
        return <Heart size={20} className="text-primary fill-primary" />;
      case 'new_message':
        return <MessageCircle size={20} className="text-secondary" />;
      case 'new_event':
        return <Calendar size={20} className="text-accent" />;
      default:
        return <Heart size={20} className="text-muted-foreground" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.notification_type === 'new_message' && notification.data?.match_id) {
      navigate(`/chat/${notification.data.match_id}`);
    } else if (notification.notification_type === 'new_match' && notification.data?.match_id) {
      navigate('/matches');
    } else if (notification.notification_type === 'new_event' && notification.data?.event_id) {
      navigate('/events');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary">Caricamento notifiche...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-panel border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <h1 className="font-display text-xl">Notifiche</h1>
          </div>
          {notifications.length > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <CheckCheck size={14} />
              Segna tutte
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 space-y-2 mt-4">
        {notifications.length === 0 && (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">
              Nessuna notifica
            </p>
          </div>
        )}

        {notifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => handleNotificationClick(notification)}
            className={`glass-panel p-4 cursor-pointer hover:bg-muted/30 transition-colors relative ${
              !notification.read ? 'border-l-2 border-l-primary' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                !notification.read ? 'bg-primary/10' : 'bg-muted/50'
              }`}>
                {getIcon(notification.notification_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {notification.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {notification.message}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: it
                  })}
                </p>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
                className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash2 size={14} className="text-destructive" />
              </button>
            </div>
            
            {!notification.read && (
              <div className="absolute top-4 right-12 w-2 h-2 rounded-full bg-primary" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
