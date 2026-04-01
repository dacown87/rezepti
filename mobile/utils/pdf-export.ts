// Type-stub so TypeScript can resolve @/utils/pdf-export.
// Metro resolves to pdf-export.native.ts or pdf-export.web.ts at build time.
import type { Recipe } from '@/db/schema';
export declare function shareRecipePDF(recipe: Recipe): Promise<void>;
