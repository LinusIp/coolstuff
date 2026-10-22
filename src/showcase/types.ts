export type Category = 'game' | 'blog-design' | 'website' | 'ui-concept' | 'tool' | 'experiment' | 'ai' | 'audio';

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  category: Category;
  tags: string[];
  tech: string[];
  date: string;
  status: 'shipped' | 'wip';
  mobile: boolean;
  hasThumb: boolean;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  game: 'Games',
  'blog-design': 'Blog designs',
  website: 'Websites',
  'ui-concept': 'UI concepts',
  tool: 'Tools',
  experiment: 'Experiments',
  ai: 'AI',
  audio: 'Audio',
};

export const CATEGORY_SINGULAR: Record<Category, string> = {
  game: 'Game',
  'blog-design': 'Blog design',
  website: 'Website',
  'ui-concept': 'UI concept',
  tool: 'Tool',
  experiment: 'Experiment',
  ai: 'AI',
  audio: 'Audio',
};
