import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Send,
  Music2,
  type LucideIcon,
} from 'lucide-react';
import type { Platform } from '@/data/services';

export const platformIcon: Record<Platform, LucideIcon> = {
  Instagram,
  YouTube: Youtube,
  TikTok: Music2,
  Telegram: Send,
  Facebook,
  X: Twitter,
};
