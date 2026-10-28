import { z } from 'zod';
import {
  ACTIVITY_LEVELS,
  DIET_PREFERENCES,
  FITNESS_LEVELS,
  GENDERS,
  GOAL_TYPES,
} from '../types/enums';

/**
 * Shared validator building blocks. Zod object schemas strip unknown keys by
 * default, which is what stops mass-assignment on every write endpoint.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email is required')
  .max(254)
  .email('Enter a valid email address');

/** Deliberately permissive but blocks the obviously unsafe choices. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(60);

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Malformed identifier');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

export const dateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date-time');

export const genderSchema = z.enum(GENDERS);
export const fitnessLevelSchema = z.enum(FITNESS_LEVELS);
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS);
export const goalTypeSchema = z.enum(GOAL_TYPES);
export const dietPreferenceSchema = z.enum(DIET_PREFERENCES);

export const heightSchema = z.coerce
  .number({ message: 'Height must be a number' })
  .min(90, 'Height must be at least 90 cm')
  .max(250, 'Height must be at most 250 cm');

export const weightSchema = z.coerce
  .number({ message: 'Weight must be a number' })
  .min(25, 'Weight must be at least 25 kg')
  .max(350, 'Weight must be at most 350 kg');

export const ageSchema = z.coerce
  .number({ message: 'Age must be a number' })
  .int('Age must be a whole number')
  .min(13, 'You must be at least 13 to use this app')
  .max(100, 'Please enter a valid age');

/** Shared list/pagination query shape. `z.coerce` turns ?page=2 into a number. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const searchQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  sort: z.string().trim().max(30).optional(),
});

export const idParamSchema = z.object({ id: objectIdSchema });

/** `"a,b,c"` -> array, and accepts a repeated query key too. */
export const csvArray = (max = 20) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return [];
      const parts = Array.isArray(value) ? value : value.split(',');
      return parts.map((item) => item.trim()).filter(Boolean).slice(0, max);
    });

export const booleanQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((value) => value === true || value === 'true' || value === '1');

export const allergenSchema = z.enum([
  'gluten',
  'dairy',
  'eggs',
  'nuts',
  'peanuts',
  'soy',
  'fish',
  'shellfish',
  'sesame',
]);
