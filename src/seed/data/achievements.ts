/**
 * Achievement catalogue. Triggers are evaluated by
 * `src/services/achievement.service.ts`; the thresholds here are the single
 * source of truth for what counts as a badge.
 */

import type { AchievementTrigger } from '../../models/Achievement';

export interface SeedAchievement {
  key: string;
  title: string;
  description: string;
  trigger: AchievementTrigger;
  threshold: number;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
  category: string;
  sortOrder: number;
}

export const ACHIEVEMENTS: SeedAchievement[] = [
  // Getting started
  { key: 'profile_complete', title: 'All Set', description: 'Complete your profile so recommendations can get personal.', trigger: 'profile_complete', threshold: 1, icon: 'user-check', tier: 'bronze', points: 10, category: 'profile', sortOrder: 1 },
  { key: 'first_workout', title: 'First Steps', description: 'Finish your very first workout.', trigger: 'first_workout', threshold: 1, icon: 'play', tier: 'bronze', points: 15, category: 'workout', sortOrder: 2 },
  { key: 'first_yoga', title: 'Finding Balance', description: 'Complete your first yoga session.', trigger: 'first_yoga', threshold: 1, icon: 'flower', tier: 'bronze', points: 15, category: 'yoga', sortOrder: 3 },
  { key: 'first_meal_plan', title: 'Planned and Portioned', description: 'Generate your first meal plan.', trigger: 'first_meal_plan', threshold: 1, icon: 'clipboard', tier: 'bronze', points: 10, category: 'nutrition', sortOrder: 4 },
  { key: 'first_weight_log', title: 'On the Scale', description: 'Log your first weight entry.', trigger: 'weight_logged', threshold: 1, icon: 'scale', tier: 'bronze', points: 10, category: 'progress', sortOrder: 5 },

  // Workout milestones
  { key: 'workouts_5', title: 'Warmed Up', description: 'Complete 5 workouts.', trigger: 'workout_count', threshold: 5, icon: 'dumbbell', tier: 'bronze', points: 20, category: 'workout', sortOrder: 10 },
  { key: 'workouts_25', title: 'Finding Rhythm', description: 'Complete 25 workouts.', trigger: 'workout_count', threshold: 25, icon: 'dumbbell', tier: 'silver', points: 50, category: 'workout', sortOrder: 11 },
  { key: 'workouts_100', title: 'Century Club', description: 'Complete 100 workouts. That is a habit now.', trigger: 'workout_count', threshold: 100, icon: 'trophy', tier: 'gold', points: 150, category: 'workout', sortOrder: 12 },
  { key: 'workouts_365', title: 'Unstoppable', description: 'Complete 365 workouts. A full year of training.', trigger: 'workout_count', threshold: 365, icon: 'crown', tier: 'platinum', points: 500, category: 'workout', sortOrder: 13 },

  // Streaks
  { key: 'streak_3', title: 'Three in a Row', description: 'Stay active 3 days in a row.', trigger: 'streak_days', threshold: 3, icon: 'flame', tier: 'bronze', points: 20, category: 'streak', sortOrder: 20 },
  { key: 'streak_7', title: 'One Week Strong', description: 'Stay active 7 days in a row.', trigger: 'streak_days', threshold: 7, icon: 'flame', tier: 'silver', points: 50, category: 'streak', sortOrder: 21 },
  { key: 'streak_30', title: 'Monthly Discipline', description: 'Stay active 30 days in a row.', trigger: 'streak_days', threshold: 30, icon: 'flame', tier: 'gold', points: 150, category: 'streak', sortOrder: 22 },
  { key: 'streak_100', title: 'Century of Consistency', description: 'Stay active 100 days in a row.', trigger: 'streak_days', threshold: 100, icon: 'crown', tier: 'platinum', points: 400, category: 'streak', sortOrder: 23 },

  // Yoga
  { key: 'yoga_10', title: 'Finding Flow', description: 'Complete 10 yoga sessions.', trigger: 'yoga_count', threshold: 10, icon: 'flower', tier: 'bronze', points: 25, category: 'yoga', sortOrder: 30 },
  { key: 'yoga_50', title: 'Steady Practice', description: 'Complete 50 yoga sessions.', trigger: 'yoga_count', threshold: 50, icon: 'flower', tier: 'silver', points: 80, category: 'yoga', sortOrder: 31 },
  { key: 'yoga_100', title: 'Devoted', description: 'Complete 100 yoga sessions.', trigger: 'yoga_count', threshold: 100, icon: 'crown', tier: 'gold', points: 180, category: 'yoga', sortOrder: 32 },

  // Hydration
  { key: 'water_2l_once', title: 'Well Watered', description: 'Hit your 2 litre water target in a single day.', trigger: 'water_total', threshold: 2000, icon: 'droplet', tier: 'bronze', points: 10, category: 'hydration', sortOrder: 40 },
  { key: 'water_3l_once', title: 'Wellness Warrior', description: 'Hit 3 litres of water in a single day.', trigger: 'water_total', threshold: 3000, icon: 'droplet', tier: 'silver', points: 25, category: 'hydration', sortOrder: 41 },
  { key: 'water_4l_once', title: 'Hydration Hero', description: 'Hit 4 litres of water in a single day.', trigger: 'water_total', threshold: 4000, icon: 'crown', tier: 'gold', points: 60, category: 'hydration', sortOrder: 42 },

  // Nutrition
  { key: 'food_logs_10', title: 'Tracking Habit', description: 'Log 10 food entries.', trigger: 'food_log_count', threshold: 10, icon: 'book', tier: 'bronze', points: 20, category: 'nutrition', sortOrder: 50 },
  { key: 'food_logs_50', title: 'Nutritionally Aware', description: 'Log 50 food entries.', trigger: 'food_log_count', threshold: 50, icon: 'book', tier: 'silver', points: 60, category: 'nutrition', sortOrder: 51 },
  { key: 'food_logs_200', title: 'Meticulous', description: 'Log 200 food entries.', trigger: 'food_log_count', threshold: 200, icon: 'trophy', tier: 'gold', points: 150, category: 'nutrition', sortOrder: 52 },

  // Goals
  { key: 'first_goal', title: 'Goal Setter', description: 'Create your first goal.', trigger: 'goal_completed', threshold: 1, icon: 'target', tier: 'bronze', points: 15, category: 'goals', sortOrder: 60 },
  { key: 'goals_5_complete', title: 'Follow Through', description: 'Complete 5 goals.', trigger: 'goal_completed', threshold: 5, icon: 'target', tier: 'silver', points: 75, category: 'goals', sortOrder: 61 },
  { key: 'goals_15_complete', title: 'Goal Machine', description: 'Complete 15 goals.', trigger: 'goal_completed', threshold: 15, icon: 'crown', tier: 'gold', points: 200, category: 'goals', sortOrder: 62 },

  // Time of day
  { key: 'early_bird_5', title: 'Early Riser', description: 'Complete 5 sessions before 7 am.', trigger: 'early_bird', threshold: 5, icon: 'sunrise', tier: 'silver', points: 40, category: 'streak', sortOrder: 70 },
  { key: 'early_bird_25', title: 'Dawn Patrol', description: 'Complete 25 sessions before 7 am.', trigger: 'early_bird', threshold: 25, icon: 'sunrise', tier: 'gold', points: 120, category: 'streak', sortOrder: 71 },
];
