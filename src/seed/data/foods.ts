/**
 * Food catalogue.
 *
 * Nutrition values are per 100 g and are approximate reference values taken from
 * public composition tables (USDA FoodData Central and IFCT 2017 for Indian
 * foods). They are NOT laboratory measurements. The API labels them as estimates
 * in every response, and the app never presents them as medical advice.
 */

import { DIET_PREFERENCES, type DietPreference, type FoodCategory, type FoodOrigin } from '../../types/enums';

export interface SeedServing {
  name: string;
  grams: number;
  isDefault: boolean;
}

export interface SeedFood {
  slug: string;
  name: string;
  localName: string;
  category: FoodCategory;
  origin: FoodOrigin;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  servings: SeedServing[];
  defaultServingGrams: number;
  dietTags: DietPreference[];
  dietaryFlags: string[];
  allergens: string[];
  healthScore: number;
  isCommon: boolean;
}

const food = (
  slug: string,
  name: string,
  localName: string,
  category: FoodCategory,
  origin: FoodOrigin,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  fiberG: number,
  sugarG: number,
  sodiumMg: number,
  healthScore: number,
  servings: SeedServing[],
  /**
   * Diet *preferences* this food suits plus any dietary attributes it has
   * ("gluten_free"). Entries are partitioned against `DIET_PREFERENCES` below,
   * so call sites can list both without a second argument and the split can
   * never drift out of sync with the model's enum.
   */
  diets: string[],
  allergens: string[],
  isCommon = true,
): SeedFood => {
  const dietTags = diets.filter((tag): tag is DietPreference =>
    (DIET_PREFERENCES as readonly string[]).includes(tag),
  );
  const dietaryFlags = diets.filter((tag) => !(DIET_PREFERENCES as readonly string[]).includes(tag));

  return {
    slug,
    name,
    localName,
    category,
    origin,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    sugarG,
    sodiumMg,
    healthScore,
    servings,
    defaultServingGrams: servings.find((s) => s.isDefault)?.grams ?? servings[0]?.grams ?? 100,
    dietTags,
    dietaryFlags,
    allergens,
    isCommon,
  };
};

export const FOODS: SeedFood[] = [
  // ----------------------------- Grains -----------------------------
  food('white-rice-cooked', 'White Rice (cooked)', 'Chawal', 'grains', 'south_asian', 130, 2.7, 28.2, 0.3, 0.4, 0.1, 1, 55, [
    { name: '1 cup cooked', grams: 158, isDefault: true },
    { name: 'Half cup cooked', grams: 79, isDefault: false },
    { name: '1 cup raw', grams: 185, isDefault: false },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('brown-rice-cooked', 'Brown Rice (cooked)', 'Brown Chawal', 'grains', 'south_asian', 123, 2.7, 25.6, 1, 1.6, 0.2, 4, 72, [
    { name: '1 cup cooked', grams: 195, isDefault: true },
    { name: '1 cup raw', grams: 200, isDefault: false },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('whole-wheat-roti', 'Whole Wheat Roti', 'Roti / Chapati', 'grains', 'south_asian', 297, 12.3, 56.4, 3.4, 7.1, 0.4, 300, 70, [
    { name: '1 medium roti', grams: 45, isDefault: true },
    { name: '1 large roti', grams: 60, isDefault: false },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], ['gluten']),
  food('whole-wheat-naan', 'Whole Wheat Naan', 'Naan', 'grains', 'south_asian', 312, 9.6, 60.2, 3.2, 4.1, 1.8, 480, 58, [
    { name: '1 medium naan', grams: 90, isDefault: true },
    { name: '1 large naan', grams: 130, isDefault: false },
  ], ['vegetarian', 'vegan'], ['gluten']),
  food('quinoa-cooked', 'Quinoa (cooked)', '', 'grains', 'global', 120, 4.4, 21.3, 1.9, 2.8, 0.9, 7, 85, [
    { name: '1 cup cooked', grams: 185, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('oats-dry', 'Rolled Oats', '', 'grains', 'global', 379, 13.2, 67.7, 6.5, 10.1, 0.9, 6, 82, [
    { name: '40 g portion', grams: 40, isDefault: true },
    { name: '1 cup dry', grams: 80, isDefault: false },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], ['gluten']),
  food('whole-wheat-bread', 'Whole Wheat Bread', '', 'grains', 'global', 247, 13, 41, 3.4, 6.8, 4.3, 400, 68, [
    { name: '1 slice', grams: 28, isDefault: true },
    { name: '2 slices', grams: 56, isDefault: false },
  ], ['vegetarian', 'vegan'], ['gluten']),
  food('pasta-cooked', 'Pasta (cooked)', '', 'grains', 'global', 158, 5.8, 30.9, 0.9, 1.8, 0.6, 1, 50, [
    { name: '1 cup cooked', grams: 140, isDefault: true },
  ], ['vegetarian', 'vegan'], ['gluten']),
  food('buckwheat-noodles', 'Soba Noodles (dry)', '', 'grains', 'global', 336, 14.4, 71, 0.6, 4.8, 0, 60, 70, [
    { name: '1 serving dry', grams: 85, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian'], ['gluten']),
  food('corn-tortilla', 'Corn Tortilla', '', 'grains', 'global', 218, 5.7, 44.6, 2.9, 6.3, 0.5, 45, 66, [
    { name: '1 tortilla', grams: 25, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),

  // ----------------------------- Protein -----------------------------
  food('chicken-breast-cooked', 'Chicken Breast (cooked)', 'Chicken', 'protein', 'global', 165, 31, 0, 3.6, 0, 0, 74, 84, [
    { name: '1 breast (120 g)', grams: 120, isDefault: true },
    { name: '1 breast (170 g)', grams: 170, isDefault: false },
  ], ['non_vegetarian', 'pescatarian', 'eggetarian'], []),
  food('chicken-thigh-cooked', 'Chicken Thigh (cooked)', 'Chicken', 'protein', 'global', 209, 26, 0, 10.9, 0, 0, 84, 70, [
    { name: '1 thigh (95 g)', grams: 95, isDefault: true },
  ], ['non_vegetarian', 'pescatarian', 'eggetarian'], []),
  food('egg-whole-boiled', 'Egg (whole, boiled)', 'Andha', 'protein', 'south_asian', 155, 12.6, 1.1, 10.6, 0, 1.1, 124, 76, [
    { name: '1 large egg', grams: 50, isDefault: true },
    { name: '2 large eggs', grams: 100, isDefault: false },
  ], ['vegetarian', 'pescatarian', 'eggetarian', 'non_vegetarian'], ['eggs'], false),
  food('egg-white', 'Egg White', 'Safed Anda', 'protein', 'south_asian', 52, 11, 0.7, 0.1, 0, 0.7, 166, 80, [
    { name: '1 white', grams: 33, isDefault: true },
    { name: '2 whites', grams: 66, isDefault: false },
  ], ['vegetarian', 'pescatarian', 'eggetarian', 'non_vegetarian'], ['eggs']),
  food('paneer', 'Paneer', '', 'protein', 'south_asian', 265, 18.3, 3.6, 20, 0, 2.6, 34, 62, [
    { name: '100 g', grams: 100, isDefault: true },
    { name: '1 cube (60 g)', grams: 60, isDefault: false },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('greek-yogurt-plain', 'Greek Yogurt (plain)', 'Dahi', 'protein', 'global', 59, 10, 3.6, 0.4, 0, 3.2, 36, 85, [
    { name: '170 g pot', grams: 170, isDefault: true },
    { name: '1 tbsp', grams: 15, isDefault: false },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('tofu-firm', 'Tofu (firm)', '', 'protein', 'global', 144, 17.3, 2.8, 8.7, 2.3, 0.6, 14, 84, [
    { name: '100 g', grams: 100, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], ['soy']),
  food('tuna-canned-water', 'Tuna (canned in water)', '', 'protein', 'global', 116, 26, 0, 0.8, 0, 0, 247, 80, [
    { name: '1 can (142 g)', grams: 142, isDefault: true },
  ], ['non_vegetarian', 'pescatarian'], ['fish']),
  food('salmon-baked', 'Salmon (baked)', '', 'protein', 'global', 208, 20.4, 0, 13.4, 0, 0, 59, 88, [
    { name: '1 fillet (150 g)', grams: 150, isDefault: true },
  ], ['non_vegetarian', 'pescatarian'], ['fish']),
  food('whey-protein', 'Whey Protein Powder', '', 'protein', 'global', 400, 80, 8, 6.7, 1, 5, 300, 70, [
    { name: '1 scoop (30 g)', grams: 30, isDefault: true },
  ], ['vegetarian'], ['dairy', 'nuts'], false),
  food('soya-chunks-dry', 'Soya Chunks (dry)', 'Nutri Nuggets', 'protein', 'south_asian', 345, 52, 32, 1.2, 12, 8, 45, 82, [
    { name: '50 g dry', grams: 50, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], ['soy']),

  // ----------------------------- Legumes -----------------------------
  food('dal-cooked', 'Toor Dal (cooked)', 'Arhar Dal', 'legumes', 'south_asian', 116, 8.3, 17.1, 2.2, 4.8, 0.7, 42, 84, [
    { name: '1 katori (150 g)', grams: 150, isDefault: true },
    { name: '1 cup (200 g)', grams: 200, isDefault: false },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('rajma-cooked', 'Rajma (kidney beans, cooked)', '', 'legumes', 'south_asian', 127, 8.7, 22.8, 0.5, 6.4, 0.3, 2, 82, [
    { name: '1 katori (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('chana-dal-cooked', 'Chana Dal (cooked)', 'Chana Dal', 'legumes', 'south_asian', 164, 8.6, 27.4, 2.6, 7.6, 3.2, 24, 82, [
    { name: '1 katori (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('moong-dal-cooked', 'Moong Dal (cooked)', 'Moong Dal', 'legumes', 'south_asian', 118, 8.4, 19.5, 2, 5.2, 0.4, 21, 84, [
    { name: '1 katori (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('lentils-cooked', 'Lentils (cooked)', 'Masoor Dal', 'legumes', 'global', 116, 9, 20.1, 0.4, 7.9, 1.8, 2, 86, [
    { name: '1 cup (198 g)', grams: 198, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('chickpeas-cooked', 'Chickpeas (cooked)', 'Chana', 'legumes', 'middle_eastern', 164, 8.9, 27.4, 2.6, 7.6, 4.8, 7, 82, [
    { name: '1 cup (164 g)', grams: 164, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('black-beans-cooked', 'Black Beans (cooked)', 'Rajma', 'legumes', 'global', 132, 8.9, 23.7, 0.5, 8.7, 0.3, 1, 84, [
    { name: '1 cup (172 g)', grams: 172, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),

  // ----------------------------- Dairy -----------------------------
  food('milk-toned', 'Milk (toned)', 'Doodh', 'dairy', 'south_asian', 61, 2.6, 4.8, 3, 0, 4.8, 40, 60, [
    { name: '1 glass (200 ml)', grams: 200, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('milk-skimmed', 'Milk (skimmed)', '', 'dairy', 'global', 34, 3.4, 5, 0.1, 0, 5, 42, 70, [
    { name: '1 glass (250 ml)', grams: 250, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('curd', 'Curd / Dahi', 'Dahi', 'dairy', 'south_asian', 61, 3.5, 4.7, 3.3, 0, 4.6, 39, 66, [
    { name: '1 katori (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('paneer-tikka', 'Paneer Tikka (cooked)', '', 'prepared_dishes', 'south_asian', 200, 14, 8, 12, 1.5, 3, 420, 58, [
    { name: '1 skewer (120 g)', grams: 120, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('butter', 'Butter', 'Makhan', 'dairy', 'global', 717, 0.9, 0.1, 81.1, 0, 0.1, 11, 30, [
    { name: '1 tsp (5 g)', grams: 5, isDefault: true },
    { name: '1 tbsp (15 g)', grams: 15, isDefault: false },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('cheese-cheddar', 'Cheddar Cheese', '', 'dairy', 'global', 403, 25, 1.3, 33.1, 0, 0.5, 621, 35, [
    { name: '30 g', grams: 30, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy']),

  // ----------------------------- Fruits -----------------------------
  food('banana', 'Banana', 'Kela', 'fruits', 'global', 89, 1.1, 22.8, 0.3, 2.6, 12.2, 1, 78, [
    { name: '1 medium (118 g)', grams: 118, isDefault: true },
    { name: '1 small (100 g)', grams: 100, isDefault: false },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('apple', 'Apple', 'Seb', 'fruits', 'global', 52, 0.3, 13.8, 0.2, 2.4, 10.4, 1, 82, [
    { name: '1 medium (182 g)', grams: 182, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('mango', 'Mango', 'Aam', 'fruits', 'south_asian', 60, 0.8, 15, 0.4, 1.6, 13.7, 1, 76, [
    { name: '1 cup (165 g)', grams: 165, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('orange', 'Orange', 'Santra', 'fruits', 'global', 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 80, [
    { name: '1 medium (131 g)', grams: 131, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('strawberries', 'Strawberries', '', 'fruits', 'global', 32, 0.7, 7.7, 0.3, 2, 4.9, 1, 90, [
    { name: '1 cup (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('blueberries', 'Blueberries', '', 'fruits', 'global', 57, 0.7, 14.5, 0.3, 2.4, 10, 1, 88, [
    { name: '1 cup (148 g)', grams: 148, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('papaya', 'Papaya', 'Papita', 'fruits', 'south_asian', 43, 0.6, 10.9, 0.1, 1.8, 7.8, 8, 82, [
    { name: '1 cup (140 g)', grams: 140, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('guava', 'Guava', 'Amrud', 'fruits', 'south_asian', 68, 2.6, 14.3, 1, 5.4, 8.9, 28, 86, [
    { name: '1 medium (110 g)', grams: 110, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('watermelon', 'Watermelon', 'Tarbooz', 'fruits', 'south_asian', 30, 0.6, 7.6, 0.2, 0.4, 6.2, 1, 86, [
    { name: '1 cup (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),

  // ----------------------------- Vegetables -----------------------------
  food('broccoli-cooked', 'Broccoli (cooked)', '', 'vegetables', 'global', 35, 2.4, 7.2, 0.4, 3.3, 1.4, 41, 92, [
    { name: '1 cup (156 g)', grams: 156, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('spinach-cooked', 'Spinach (cooked)', 'Palak', 'vegetables', 'south_asian', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 63, 88, [
    { name: '1 cup (180 g)', grams: 180, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('carrot-cooked', 'Carrot (cooked)', 'Gajar', 'vegetables', 'south_asian', 35, 0.8, 8.2, 0.3, 3, 3.2, 58, 84, [
    { name: '1 medium (61 g)', grams: 61, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('tomato', 'Tomato', 'Tamatar', 'vegetables', 'south_asian', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 88, [
    { name: '1 medium (123 g)', grams: 123, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('potato-boiled', 'Potato (boiled)', 'Aloo', 'vegetables', 'south_asian', 87, 1.9, 20.1, 0.1, 1.8, 0.8, 4, 72, [
    { name: '1 medium (173 g)', grams: 173, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('sweet-potato-boiled', 'Sweet Potato (boiled)', 'Shakarkandi', 'vegetables', 'south_asian', 90, 2, 20.7, 0.2, 3.3, 6.5, 36, 78, [
    { name: '1 medium (180 g)', grams: 180, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('onion', 'Onion', 'Pyaaz', 'vegetables', 'south_asian', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 4, 74, [
    { name: '1 medium (110 g)', grams: 110, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('cucumber', 'Cucumber', 'Kheera', 'vegetables', 'south_asian', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 88, [
    { name: '1 medium (200 g)', grams: 200, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('bhindi', 'Bhindi (Okra)', 'Bhindi', 'vegetables', 'south_asian', 33, 1.9, 7, 0.3, 3.2, 2.3, 7, 80, [
    { name: '1 cup (100 g)', grams: 100, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('bottle-gourd', 'Bottle Gourd (Lauki)', 'Doodhi', 'vegetables', 'south_asian', 15, 0.6, 3.6, 0.1, 0.5, 2.8, 1.7, 88, [
    { name: '1 katori (150 g)', grams: 150, isDefault: true },
  ], ['vegetarian', 'vegan', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('capsicum', 'Capsicum (Bell Pepper)', 'Shimla Mirch', 'vegetables', 'south_asian', 31, 1, 6, 0.3, 2.1, 4.2, 4, 88, [
    { name: '1 medium (119 g)', grams: 119, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),

  // ----------------------------- Nuts and seeds -----------------------------
  food('almonds', 'Almonds', 'Badam', 'nuts_seeds', 'global', 579, 21.2, 21.6, 49.9, 12.5, 4.4, 1, 82, [
    { name: '10 almonds (12 g)', grams: 12, isDefault: true },
    { name: '1 handful (30 g)', grams: 30, isDefault: false },
  ], ['vegetarian', 'vegan', 'gluten_free'], ['nuts']),
  food('walnuts', 'Walnuts', 'Akhrot', 'nuts_seeds', 'global', 654, 15.2, 13.7, 65.2, 6.7, 2.6, 2, 80, [
    { name: '4 halves (20 g)', grams: 20, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], ['nuts']),
  food('peanuts', 'Peanuts', 'Moongphali', 'nuts_seeds', 'south_asian', 567, 25.8, 16.1, 49.2, 8.5, 4.7, 18, 70, [
    { name: '1 handful (30 g)', grams: 30, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], ['peanuts']),
  food('peanut-butter', 'Peanut Butter', '', 'nuts_seeds', 'global', 588, 25, 20, 50, 6, 9, 17, 62, [
    { name: '1 tbsp (16 g)', grams: 16, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], ['peanuts']),
  food('chia-seeds', 'Chia Seeds', '', 'nuts_seeds', 'global', 486, 16.5, 42.1, 30.7, 34.4, 0, 16, 82, [
    { name: '1 tbsp (12 g)', grams: 12, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('flax-seeds', 'Flax Seeds (ground)', 'Alsi', 'nuts_seeds', 'global', 534, 18.3, 28.9, 42.2, 27.3, 1.6, 30, 82, [
    { name: '1 tbsp (10 g)', grams: 10, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('sesame-seeds', 'Sesame Seeds', 'Til', 'nuts_seeds', 'south_asian', 573, 17.7, 23.4, 49.7, 11.8, 0.3, 11, 74, [
    { name: '1 tbsp (9 g)', grams: 9, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),

  // ----------------------------- Beverages -----------------------------
  food('green-tea', 'Green Tea', 'Chai', 'beverages', 'south_asian', 1, 0, 0.2, 0, 0, 0, 1, 95, [
    { name: '1 cup (200 ml)', grams: 200, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('black-coffee-unsweetened', 'Coffee (black, no sugar)', 'Chai', 'beverages', 'global', 1, 0.1, 0, 0, 0, 0, 2, 88, [
    { name: '1 cup (240 ml)', grams: 240, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('orange-juice', 'Orange Juice', '', 'beverages', 'global', 45, 0.7, 10.4, 0.2, 0.2, 8.4, 1, 62, [
    { name: '1 glass (250 ml)', grams: 250, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('coconut-water', 'Coconut Water', 'Nariyal Pani', 'beverages', 'south_asian', 19, 0.7, 3.7, 0.2, 0.9, 2.6, 105, 84, [
    { name: '1 glass (250 ml)', grams: 250, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('soft-drink-cola', 'Cola', '', 'beverages', 'global', 42, 0, 10.6, 0, 0, 10.6, 4, 8, [
    { name: '1 can (330 ml)', grams: 330, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),
  food('energy-drink', 'Energy Drink', '', 'beverages', 'global', 45, 0.3, 11, 0, 0, 10.5, 27, 5, [
    { name: '1 can (250 ml)', grams: 250, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], [], false),

  // ----------------------------- Sweets -----------------------------
  food('dark-chocolate-70', 'Dark Chocolate (70%)', '', 'sweets', 'global', 598, 7.8, 45.9, 42.6, 10.9, 24, 20, 55, [
    { name: '2 squares (20 g)', grams: 20, isDefault: true },
  ], ['vegetarian'], ['dairy', 'nuts'], false),
  food('biscuits-marie', 'Biscuits (Marie)', '', 'sweets', 'south_asian', 400, 8, 70, 12, 2, 12, 300, 22, [
    { name: '2 biscuits (20 g)', grams: 20, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['gluten', 'dairy'], false),
  food('gulab-jamun', 'Gulab Jamun', 'Gulab Jamun', 'sweets', 'south_asian', 290, 3.5, 50, 8, 0.5, 45, 90, 20, [
    { name: '1 piece (50 g)', grams: 50, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy'], false),
  food('jalebi', 'Jalebi', 'Jalebi', 'sweets', 'south_asian', 300, 2, 65, 6, 0.3, 55, 105, 18, [
    { name: '100 g', grams: 100, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['gluten', 'dairy'], false),
  food('cake-plain', 'Plain Cake', '', 'sweets', 'global', 371, 5, 55, 15, 1, 40, 320, 25, [
    { name: '1 slice (80 g)', grams: 80, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['gluten', 'dairy', 'eggs'], false),

  // ----------------------------- Snacks -----------------------------
  food('potato-chips', 'Potato Chips', 'Chips', 'snacks', 'global', 536, 6.6, 52.9, 34.6, 4.8, 0.3, 525, 15, [
    { name: 'Small pack (30 g)', grams: 30, isDefault: true },
  ], ['vegetarian', 'vegan'], [], false),
  food('samosa', 'Samosa', 'Samosa', 'snacks', 'south_asian', 262, 6.2, 30, 12.5, 2.5, 1.5, 480, 28, [
    { name: '1 samosa (100 g)', grams: 100, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['gluten'], false),
  food('pakora', 'Pakora', 'Pakoda', 'snacks', 'south_asian', 290, 6.5, 32, 15, 2, 1, 520, 25, [
    { name: '100 g', grams: 100, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['gluten'], false),
  food('sprouts-moong', 'Sprouted Moong', '', 'snacks', 'south_asian', 105, 8.4, 18.3, 0.6, 5.6, 0, 8, 88, [
    { name: '1 katori (100 g)', grams: 100, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('popcorn-air', 'Popcorn (air popped)', '', 'snacks', 'global', 387, 12.9, 77.9, 4.5, 14.5, 0.6, 8, 72, [
    { name: '1 cup (8 g)', grams: 8, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free'], []),

  // ----------------------------- Prepared dishes -----------------------------
  food('chicken-biryani-cooked', 'Chicken Biryani (cooked)', 'Biryani', 'prepared_dishes', 'south_asian', 180, 7.5, 24, 6.5, 1.2, 1.8, 420, 58, [
    { name: '1 plate (350 g)', grams: 350, isDefault: true },
  ], ['non_vegetarian', 'eggetarian'], ['dairy']),
  food('veg-biryani-cooked', 'Veg Biryani (cooked)', 'Veg Biryani', 'prepared_dishes', 'south_asian', 170, 4.2, 28, 4.8, 1.5, 1.6, 400, 62, [
    { name: '1 plate (350 g)', grams: 350, isDefault: true },
  ], ['vegetarian', 'vegan', 'eggetarian'], []),
  food('butter-chicken', 'Butter Chicken', 'Butter Chicken', 'prepared_dishes', 'south_asian', 210, 12, 5, 16, 0.8, 3.2, 480, 50, [
    { name: '1 bowl (300 g)', grams: 300, isDefault: true },
  ], ['non_vegetarian', 'eggetarian'], ['dairy']),
  food('dal-makhani', 'Dal Makhani', 'Dal Makhani', 'prepared_dishes', 'south_asian', 160, 6.5, 20, 6.5, 3.5, 1.2, 340, 66, [
    { name: '1 bowl (250 g)', grams: 250, isDefault: true },
  ], ['vegetarian', 'vegan'], []),
  food('palak-paneer', 'Palak Paneer', 'Palak Paneer', 'prepared_dishes', 'south_asian', 165, 7.2, 8, 12.5, 2, 1.2, 380, 60, [
    { name: '1 bowl (250 g)', grams: 250, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['dairy']),
  food('rajma-chawal', 'Rajma Chawal', 'Rajma Chawal', 'prepared_dishes', 'south_asian', 145, 5.5, 24, 2.5, 4.5, 1, 260, 74, [
    { name: '1 plate (400 g)', grams: 400, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('khichdi', 'Khichdi', 'Khichdi', 'prepared_dishes', 'south_asian', 130, 4.5, 23, 2, 2.2, 0.8, 210, 76, [
    { name: '1 bowl (300 g)', grams: 300, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('chole-bhature', 'Chole Bhature', 'Chole Bhature', 'prepared_dishes', 'south_asian', 220, 7.5, 30, 8, 3.5, 1.5, 520, 45, [
    { name: '1 plate (400 g)', grams: 400, isDefault: true },
  ], ['vegetarian', 'eggetarian'], ['gluten'], false),
  food('idli', 'Idli', 'Idli', 'prepared_dishes', 'south_asian', 146, 4.6, 30, 0.7, 1.3, 0.5, 240, 76, [
    { name: '2 pieces (80 g)', grams: 80, isDefault: true },
  ], ['vegetarian', 'vegan', 'gluten_free', 'pescatarian', 'eggetarian', 'non_vegetarian'], []),
  food('dosa', 'Dosa', 'Dosa', 'prepared_dishes', 'south_asian', 190, 4.2, 33, 5.5, 1.2, 0.8, 380, 62, [
    { name: '1 dosa (100 g)', grams: 100, isDefault: true },
  ], ['vegetarian', 'vegan', 'eggetarian'], ['gluten']),
  food('poha', 'Poha', 'Poha / Kanda Poha', 'prepared_dishes', 'south_asian', 135, 3.2, 26, 1.8, 1.5, 0.5, 300, 70, [
    { name: '1 plate (250 g)', grams: 250, isDefault: true },
  ], ['vegetarian', 'vegan', 'eggetarian'], []),
  food('upma', 'Upma', 'Upma', 'prepared_dishes', 'south_asian', 140, 4, 24, 3, 2, 0.6, 280, 72, [
    { name: '1 plate (250 g)', grams: 250, isDefault: true },
  ], ['vegetarian', 'vegan', 'eggetarian'], []),
];
