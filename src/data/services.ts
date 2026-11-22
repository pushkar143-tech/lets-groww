export type Platform =
  | 'Instagram'
  | 'YouTube'
  | 'TikTok'
  | 'Telegram'
  | 'Facebook'
  | 'X';

export type Quality = 'Basic' | 'Medium' | 'High Non-Drop';

export interface Service {
  id: number;
  platform: Platform;
  category: 'Followers' | 'Likes' | 'Views' | 'Story Views' | 'Dashboard Views' | 'Repost' | 'Subscribers' | 'Members' | 'Retweets';
  name: string;
  ratePer1000: number; // INR
  min: number;
  max: number;
  quality?: Quality;
  speed: string;
}

export const platformMeta: Record<
  Platform,
  { gradient: string; ring: string; short: string }
> = {
  Instagram: { gradient: 'from-pink-500 to-purple-600', ring: 'ring-pink-500/40', short: 'IG' },
  YouTube: { gradient: 'from-red-500 to-rose-600', ring: 'ring-red-500/40', short: 'YT' },
  TikTok: { gradient: 'from-cyan-400 to-fuchsia-500', ring: 'ring-cyan-400/40', short: 'TT' },
  Telegram: { gradient: 'from-sky-400 to-blue-600', ring: 'ring-sky-400/40', short: 'TG' },
  Facebook: { gradient: 'from-blue-500 to-indigo-600', ring: 'ring-blue-500/40', short: 'FB' },
  X: { gradient: 'from-zinc-300 to-zinc-500', ring: 'ring-zinc-300/40', short: 'X' },
};

export const platformFilters: (Platform | 'All')[] = [
  'All',
  'Instagram',
  'YouTube',
  'TikTok',
  'Telegram',
  'Facebook',
  'X',
];

// Rate helpers derived from the requested starting prices (INR per 1000)
// Instagram / Facebook Followers: Basic 500, Medium 600, High Non-Drop 700
// Instagram / Facebook Likes: Basic 50, Medium 150, High Non-Drop 200
// Instagram Repost: 150
// YouTube Subscribers: Basic 4000, Medium 4500, High Non-Drop 5000
// YouTube Likes: 400 · YouTube Views: 300

let sid = 1000;

const make = (s: Omit<Service, 'id'>): Service => ({ ...s, id: sid++ });

export const services: Service[] = [
  // Instagram Followers
  make({ platform: 'Instagram', category: 'Followers', name: 'Instagram Followers — Basic Quality', ratePer1000: 500, min: 100, max: 100000, quality: 'Basic', speed: '0–6 hrs' }),
  make({ platform: 'Instagram', category: 'Followers', name: 'Instagram Followers — Medium Quality', ratePer1000: 600, min: 100, max: 100000, quality: 'Medium', speed: '0–4 hrs' }),
  make({ platform: 'Instagram', category: 'Followers', name: 'Instagram Followers — High Non-Drop', ratePer1000: 700, min: 50, max: 50000, quality: 'High Non-Drop', speed: '0–2 hrs' }),

  // Instagram Likes
  make({ platform: 'Instagram', category: 'Likes', name: 'Instagram Likes — Basic Quality', ratePer1000: 50, min: 50, max: 50000, quality: 'Basic', speed: 'Instant' }),
  make({ platform: 'Instagram', category: 'Likes', name: 'Instagram Likes — Medium Quality', ratePer1000: 150, min: 50, max: 50000, quality: 'Medium', speed: '0–30 min' }),
  make({ platform: 'Instagram', category: 'Likes', name: 'Instagram Likes — High Non-Drop', ratePer1000: 200, min: 20, max: 30000, quality: 'High Non-Drop', speed: 'Instant' }),

  // Instagram Repost
  make({ platform: 'Instagram', category: 'Repost', name: 'Instagram Repost / Story Share', ratePer1000: 150, min: 50, max: 20000, speed: '0–1 hr' }),

  // Instagram Views
  make({ platform: 'Instagram', category: 'Views', name: 'Instagram Reels / Video Views', ratePer1000: 30, min: 100, max: 1000000, speed: 'Instant' }),

  // YouTube Subscribers
  make({ platform: 'YouTube', category: 'Subscribers', name: 'YouTube Subscribers — Basic Quality', ratePer1000: 4000, min: 50, max: 20000, quality: 'Basic', speed: '1–3 days' }),
  make({ platform: 'YouTube', category: 'Subscribers', name: 'YouTube Subscribers — Medium Quality', ratePer1000: 4500, min: 50, max: 20000, quality: 'Medium', speed: '1–2 days' }),
  make({ platform: 'YouTube', category: 'Subscribers', name: 'YouTube Subscribers — High Non-Drop', ratePer1000: 5000, min: 50, max: 15000, quality: 'High Non-Drop', speed: '1–2 days' }),

  // YouTube Likes
  make({ platform: 'YouTube', category: 'Likes', name: 'YouTube Likes — High Quality', ratePer1000: 400, min: 50, max: 50000, quality: 'High Non-Drop', speed: '0–6 hrs' }),

  // YouTube Views
  make({ platform: 'YouTube', category: 'Views', name: 'YouTube Views — Real', ratePer1000: 300, min: 500, max: 1000000, speed: '0–12 hrs' }),

  // TikTok
  make({ platform: 'TikTok', category: 'Followers', name: 'TikTok Followers — Medium Quality', ratePer1000: 550, min: 100, max: 100000, quality: 'Medium', speed: '0–4 hrs' }),
  make({ platform: 'TikTok', category: 'Likes', name: 'TikTok Likes — High Quality', ratePer1000: 180, min: 50, max: 100000, quality: 'High Non-Drop', speed: 'Instant' }),
  make({ platform: 'TikTok', category: 'Views', name: 'TikTok Views', ratePer1000: 20, min: 100, max: 5000000, speed: 'Instant' }),

  // Telegram
  make({ platform: 'Telegram', category: 'Members', name: 'Telegram Channel Members', ratePer1000: 450, min: 100, max: 200000, speed: '0–6 hrs' }),
  make({ platform: 'Telegram', category: 'Views', name: 'Telegram Post Views', ratePer1000: 40, min: 100, max: 500000, speed: 'Instant' }),

  // Facebook Followers (rates match Instagram)
  make({ platform: 'Facebook', category: 'Followers', name: 'Facebook Page Followers — Basic Quality', ratePer1000: 500, min: 100, max: 100000, quality: 'Basic', speed: '0–6 hrs' }),
  make({ platform: 'Facebook', category: 'Followers', name: 'Facebook Page Followers — Medium Quality', ratePer1000: 600, min: 100, max: 100000, quality: 'Medium', speed: '0–4 hrs' }),
  make({ platform: 'Facebook', category: 'Followers', name: 'Facebook Page Followers — High Non-Drop', ratePer1000: 700, min: 50, max: 50000, quality: 'High Non-Drop', speed: '0–2 hrs' }),

  // Facebook Likes (rates match Instagram)
  make({ platform: 'Facebook', category: 'Likes', name: 'Facebook Post Likes — Basic Quality', ratePer1000: 50, min: 50, max: 50000, quality: 'Basic', speed: 'Instant' }),
  make({ platform: 'Facebook', category: 'Likes', name: 'Facebook Post Likes — Medium Quality', ratePer1000: 150, min: 50, max: 50000, quality: 'Medium', speed: '0–30 min' }),
  make({ platform: 'Facebook', category: 'Likes', name: 'Facebook Post Likes — High Non-Drop', ratePer1000: 200, min: 20, max: 30000, quality: 'High Non-Drop', speed: 'Instant' }),

  // Story Views (₹100 per 1K)
  make({ platform: 'Instagram', category: 'Story Views', name: 'Instagram Story Views', ratePer1000: 100, min: 100, max: 1000000, speed: 'Instant' }),
  make({ platform: 'Facebook', category: 'Story Views', name: 'Facebook Story Views', ratePer1000: 100, min: 100, max: 1000000, speed: 'Instant' }),

  // Dashboard Views (₹14 per 1K)
  make({ platform: 'Instagram', category: 'Dashboard Views', name: 'Instagram Reel/Post Dashboard Views', ratePer1000: 14, min: 100, max: 1000000, speed: 'Instant' }),
  make({ platform: 'YouTube', category: 'Dashboard Views', name: 'YouTube Video Dashboard Views', ratePer1000: 14, min: 100, max: 1000000, speed: 'Instant' }),

  // X (Twitter)
  make({ platform: 'X', category: 'Followers', name: 'X (Twitter) Followers', ratePer1000: 750, min: 100, max: 50000, quality: 'Medium', speed: '0–8 hrs' }),
  make({ platform: 'X', category: 'Retweets', name: 'X Retweets', ratePer1000: 300, min: 50, max: 30000, speed: '0–4 hrs' }),
  make({ platform: 'X', category: 'Likes', name: 'X Post Likes', ratePer1000: 260, min: 50, max: 50000, speed: 'Instant' }),
];

export const qualityStyles: Record<Quality, string> = {
  Basic: 'bg-white/10 text-white/70 border-white/15',
  Medium: 'bg-neon-500/15 text-neon-300 border-neon-400/30',
  'High Non-Drop': 'bg-grape-500/15 text-grape-300 border-grape-400/30',
};
