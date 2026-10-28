/**
 * Demo accounts used by the seed and by the local sign-in screen.
 *
 * Kept in its own module so verification scripts and the mobile-facing docs can
 * reference them without importing the seed runner (which connects to MongoDB
 * on import).
 */

import type {
  ActivityLevel,
  DietPreference,
  FitnessLevel,
  Gender,
  GoalType,
} from '../types/enums';

export interface DemoProfile {
  name: string;
  email: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  fitnessLevel: FitnessLevel;
  activityLevel: ActivityLevel;
  goals: GoalType[];
  dietPreference: DietPreference;
  preferredWorkoutLocation: string[];
  preferredDays: number[];
  preferredWorkoutMinutes: number;
  allergies: string[];
  dislikedFoods: string[];
}

export const DEMO_PASSWORD = 'Demo@12345';

export const DEMO_USERS: DemoProfile[] = [
  {
    name: 'Aarav Sharma',
    email: 'aarav@mepro.app',
    age: 29,
    gender: 'male',
    heightCm: 176,
    weightKg: 82.5,
    targetWeightKg: 76,
    fitnessLevel: 'intermediate',
    activityLevel: 'moderate',
    goals: ['weight_loss', 'general_fitness'],
    dietPreference: 'eggetarian',
    preferredWorkoutLocation: ['gym', 'home'],
    preferredDays: [1, 2, 4, 5, 6],
    preferredWorkoutMinutes: 45,
    allergies: [],
    dislikedFoods: [],
  },
  {
    name: 'Priya Nair',
    email: 'priya@mepro.app',
    age: 26,
    gender: 'female',
    heightCm: 162,
    weightKg: 54,
    targetWeightKg: 54,
    fitnessLevel: 'beginner',
    activityLevel: 'light',
    goals: ['stress_reduction', 'flexibility'],
    dietPreference: 'vegetarian',
    preferredWorkoutLocation: ['home', 'outdoor'],
    preferredDays: [0, 3, 6],
    preferredWorkoutMinutes: 30,
    allergies: ['peanuts'],
    dislikedFoods: ['brinjal'],
  },
  {
    name: 'Rohan Verma',
    email: 'rohan@mepro.app',
    age: 34,
    gender: 'male',
    heightCm: 181,
    weightKg: 68,
    targetWeightKg: 78,
    fitnessLevel: 'advanced',
    activityLevel: 'active',
    goals: ['muscle_gain'],
    dietPreference: 'non_vegetarian',
    preferredWorkoutLocation: ['gym'],
    preferredDays: [1, 2, 3, 4, 5],
    preferredWorkoutMinutes: 60,
    allergies: [],
    dislikedFoods: [],
  },
  {
    name: 'Ananya Iyer',
    email: 'ananya@mepro.app',
    age: 22,
    gender: 'female',
    heightCm: 158,
    weightKg: 61,
    targetWeightKg: 55,
    fitnessLevel: 'beginner',
    activityLevel: 'sedentary',
    goals: ['weight_loss', 'better_lifestyle'],
    dietPreference: 'vegan',
    preferredWorkoutLocation: ['home'],
    preferredDays: [1, 3, 5],
    preferredWorkoutMinutes: 25,
    allergies: ['dairy', 'eggs'],
    dislikedFoods: [],
  },
];
