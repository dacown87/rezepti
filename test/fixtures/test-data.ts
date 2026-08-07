/**
 * Test data fixtures for Rezepti E2E tests
 * Provides consistent test data across all test suites
 */

export interface TestRecipe {
  id?: number;
  title: string;
  url: string;
  source: 'website' | 'youtube' | 'instagram' | 'tiktok';
  ingredients: string[];
  instructions: string[];
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags: string[];
  image_url?: string;
  author?: string;
  created_at?: string;
}


export interface TestApiKey {
  key: string;
  valid: boolean;
  description: string;
}

export interface TestUrl {
  url: string;
  type: 'website' | 'youtube' | 'instagram' | 'tiktok';
  shouldWork: boolean;
  description: string;
}

// Sample recipes for database seeding
export const sampleRecipes: TestRecipe[] = [
  {
    title: 'Klassische Tomatensuppe',
    url: 'https://www.chefkoch.de/rezepte/123456/klassische-tomatensuppe.html',
    source: 'website',
    ingredients: [
      '1 kg Tomaten',
      '1 Zwiebel',
      '2 Knoblauchzehen',
      '1 EL Olivenöl',
      '1 TL Zucker',
      'Salz und Pfeffer',
      'Frischer Basilikum'
    ],
    instructions: [
      'Tomaten waschen und klein schneiden',
      'Zwiebel und Knoblauch fein hacken',
      'Olivenöl in einem Topf erhitzen',
      'Zwiebel und Knoblauch glasig dünsten',
      'Tomaten hinzufügen und 20 Minuten köcheln lassen',
      'Mit Zucker, Salz und Pfeffer abschmecken',
      'Pürieren und mit Basilikum garnieren'
    ],
    prep_time: 15,
    cook_time: 25,
    servings: 4,
    difficulty: 'easy',
    tags: ['Suppe', 'Vegetarisch', 'Einfach'],
    image_url: 'https://example.com/tomatensuppe.jpg',
    author: 'Chefkoch'
  },
  {
    title: 'Spaghetti Carbonara',
    url: 'https://www.youtube.com/watch?v=abcd1234',
    source: 'youtube',
    ingredients: [
      '400g Spaghetti',
      '200g Pancetta',
      '4 Eigelb',
      '100g Pecorino',
      'Schwarzer Pfeffer',
      'Salz'
    ],
    instructions: [
      'Spaghetti in Salzwasser al dente kochen',
      'Pancetta würfeln und knusprig braten',
      'Eigelb mit geriebenem Käse verrühren',
      'Spaghetti abgießen, mit Pancetta mischen',
      'Eimasse unterrühren',
      'Mit viel Pfeffer servieren'
    ],
    prep_time: 10,
    cook_time: 15,
    servings: 4,
    difficulty: 'medium',
    tags: ['Pasta', 'Italienisch', 'Klassiker'],
    author: 'Italienischer Koch'
  },
  {
    title: 'Avocado Toast mit Ei',
    url: 'https://www.instagram.com/p/xyz123/',
    source: 'instagram',
    ingredients: [
      '2 Scheiben Brot',
      '1 reife Avocado',
      '2 Eier',
      'Chili-Flocken',
      'Zitronensaft',
      'Salz'
    ],
    instructions: [
      'Brot toasten',
      'Avocado zerdrücken und mit Zitronensaft, Salz würzen',
      'Eier pochieren oder braten',
      'Avocado auf Toast streichen',
      'Ei darauf anrichten',
      'Mit Chili-Flocken bestreuen'
    ],
    prep_time: 5,
    cook_time: 10,
    servings: 2,
    difficulty: 'easy',
    tags: ['Frühstück', 'Gesund', 'Schnell'],
    image_url: 'https://example.com/avocadotoast.jpg'
  }
];

// Test API keys for BYOK validation
export const testApiKeys: TestApiKey[] = [
  {
    key: 'gsk_validkey1234567890abcdefghijklmnop',
    valid: true,
    description: 'Valid Groq API key format'
  },
  {
    key: 'gsk_anothervalidkey9876543210zyxwvuts',
    valid: true,
    description: 'Another valid Groq API key'
  },
  {
    key: 'invalid_key_123',
    valid: false,
    description: 'Invalid key format'
  },
  {
    key: '',
    valid: false,
    description: 'Empty key'
  },
  {
    key: 'gsk_tooshort',
    valid: false,
    description: 'Key too short'
  },
  {
    key: 'gsk_' + 'a'.repeat(100),
    valid: false,
    description: 'Key too long'
  }
];

// Test URLs for extraction testing
export const testUrls: TestUrl[] = [
  // Website URLs
  {
    url: 'https://www.allrecipes.com/recipe/12345/test-recipe/',
    type: 'website',
    shouldWork: true,
    description: 'Standard recipe website'
  },
  {
    url: 'https://www.chefkoch.de/rezepte/1234567890/klassische-tomatensuppe.html',
    type: 'website',
    shouldWork: true,
    description: 'German recipe website'
  },
  {
    url: 'https://www.bbcgoodfood.com/recipes/classic-vegetable-lasagne',
    type: 'website',
    shouldWork: true,
    description: 'BBC Good Food recipe'
  },
  {
    url: 'https://www.epicurious.com/recipes/food/views/chicken-piccata',
    type: 'website',
    shouldWork: true,
    description: 'Epicurious recipe'
  },
  
  // YouTube URLs
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'youtube',
    shouldWork: true,
    description: 'YouTube video'
  },
  {
    url: 'https://youtu.be/dQw4w9WgXcQ',
    type: 'youtube',
    shouldWork: true,
    description: 'YouTube short URL'
  },
  {
    url: 'https://www.youtube.com/shorts/ABC123def',
    type: 'youtube',
    shouldWork: true,
    description: 'YouTube Shorts'
  },
  
  // Instagram URLs
  {
    url: 'https://www.instagram.com/p/ABCDEFG12345/',
    type: 'instagram',
    shouldWork: true,
    description: 'Instagram post'
  },
  {
    url: 'https://www.instagram.com/reel/XYZ789abc/',
    type: 'instagram',
    shouldWork: true,
    description: 'Instagram reel'
  },
  {
    url: 'https://www.instagram.com/tv/LMN456def/',
    type: 'instagram',
    shouldWork: true,
    description: 'Instagram TV'
  },
  
  // TikTok URLs
  {
    url: 'https://www.tiktok.com/@user/video/1234567890',
    type: 'tiktok',
    shouldWork: true,
    description: 'TikTok video'
  },
  {
    url: 'https://vm.tiktok.com/ZMexample123/',
    type: 'tiktok',
    shouldWork: true,
    description: 'TikTok share URL'
  },
  
  // Invalid URLs
  {
    url: 'not-a-valid-url',
    type: 'website',
    shouldWork: false,
    description: 'Malformed URL'
  },
  {
    url: 'http://',
    type: 'website',
    shouldWork: false,
    description: 'Incomplete URL'
  },
  {
    url: 'https://example.com',
    type: 'website',
    shouldWork: false,
    description: 'Non-recipe website'
  },
  {
    url: 'https://www.youtube.com/',
    type: 'youtube',
    shouldWork: false,
    description: 'YouTube homepage'
  },
  {
    url: 'https://www.instagram.com/',
    type: 'instagram',
    shouldWork: false,
    description: 'Instagram homepage'
  }
];
