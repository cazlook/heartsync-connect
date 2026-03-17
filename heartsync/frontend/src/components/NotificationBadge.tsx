import { motion, AnimatePresence } from 'framer-motion';

interface NotificationBadgeProps {
  count: number;
  max?: number;
}

export default function NotificationBadge({ count, max = 99 }: NotificationBadgeProps) {
  if (count === 0) return null;
  
  const displayCount = count > max ? `${max}+` : count;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg"
      >
        {displayCount}
      </motion.div>
    </AnimatePresence>
  );
}
