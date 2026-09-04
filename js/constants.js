/**
 * CULINA — Application constants
 */

export const APP = {
  name: 'CULINA',
  tagline: 'Discover food. Understand it. Make it yours.',
  brandTagline: 'TASTE • DISCOVER • PLAN • ENJOY',
  supportingCopy: 'Recipes, ingredients, nutrition and drinks — intelligently connected.',
  version: '1.1.0',
  repoUrl: 'https://github.com/devara1983ntr/culina',
  developerCredit: 'Designed & developed by Roshan',
};

export const STORAGE_KEYS = {
  settings: 'culina:v1:settings',
  favorites: 'culina:v1:favorites',
  planner: 'culina:v1:planner',
  health: 'culina:v1:health',
  recentSearches: 'culina:v1:recent-searches',
  history: 'culina:v1:history',
  shoppingList: 'culina:v1:shopping-list',
};

export const NAV_PRIMARY = [
  { label: 'Discover', href: '/discover', icon: 'compass' },
  { label: 'Recipes', href: '/recipes', icon: 'utensils-crossed' },
  { label: 'Ingredients', href: '/ingredients', icon: 'leaf' },
  {
    label: 'Drinks',
    href: '/drinks',
    icon: 'wine',
    children: [
      { label: 'Cocktails', href: '/cocktails', icon: 'martini' },
      { label: 'Beer', href: '/beer', icon: 'beer' },
      { label: 'Breweries', href: '/breweries', icon: 'building-2' },
      { label: 'Coffee', href: '/coffee', icon: 'coffee' },
    ],
  },
  { label: 'Planner', href: '/planner', icon: 'calendar-days' },
];

export const NAV_SECONDARY = [
  { label: 'Categories', href: '/categories', icon: 'layout-grid' },
  { label: 'Cuisines', href: '/cuisines', icon: 'globe' },
  { label: 'Nutrition', href: '/nutrition', icon: 'flask-conical' },
  { label: 'Food Products', href: '/products', icon: 'package' },
  { label: 'Kitchen Match', href: '/kitchen', icon: 'chef-hat' },
  { label: 'Shopping List', href: '/shopping-list', icon: 'shopping-basket' },
  { label: 'Favorites', href: '/favorites', icon: 'heart' },
  { label: 'History', href: '/history', icon: 'clock' },
  { label: 'API Health', href: '/health', icon: 'activity' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
  { label: 'About', href: '/about', icon: 'info' },
];

/** Primary destinations in the mobile bottom navigation (5 max). */
export const NAV_BOTTOM = [
  { label: 'Home', href: '/', icon: 'house' },
  { label: 'Discover', href: '/discover', icon: 'compass' },
  { label: 'Search', href: '/search', icon: 'search', action: 'search' },
  { label: 'Planner', href: '/planner', icon: 'calendar-days' },
  { label: 'Saved', href: '/favorites', icon: 'heart' },
];

export const DAYS = [
  { id: 'monday', short: 'Mon', full: 'Monday' },
  { id: 'tuesday', short: 'Tue', full: 'Tuesday' },
  { id: 'wednesday', short: 'Wed', full: 'Wednesday' },
  { id: 'thursday', short: 'Thu', full: 'Thursday' },
  { id: 'friday', short: 'Fri', full: 'Friday' },
  { id: 'saturday', short: 'Sat', full: 'Saturday' },
  { id: 'sunday', short: 'Sun', full: 'Sunday' },
];

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export const ENTITY_LABELS = {
  recipe: 'Recipes',
  drink: 'Cocktails',
  beer: 'Beers',
  fruit: 'Fruits',
  ingredient: 'Ingredients',
  product: 'Food Products',
  brewery: 'Breweries',
  coffee: 'Coffee',
};

export const SEARCH_SHORTCUT_LIMIT = 4; // results per group in the quick overlay
