/**
 * Workout catalogue.
 *
 * Every number here is a conservative, widely published reference value
 * (ACSM-style MET estimates, standard set/rep prescriptions). The app presents
 * these as estimates and never as medical prescription.
 */

import type {
  Equipment,
  FitnessLevel,
  MuscleGroup,
  WorkoutCategory,
  WorkoutLocation,
} from '../../types/enums';

export interface SeedExercise {
  order: number;
  name: string;
  description: string;
  instructions: string[];
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
  sets: number;
  reps: string;
  restSeconds: number;
  durationSeconds: number;
  caloriesPerMinute: number;
  tips: string[];
  commonMistakes: string[];
}

export interface SeedWorkout {
  slug: string;
  title: string;
  description: string;
  category: WorkoutCategory;
  difficulty: FitnessLevel;
  location: WorkoutLocation;
  equipment: Equipment[];
  muscleGroups: MuscleGroup[];
  durationMinutes: number;
  estimatedCalories: number;
  exercises: SeedExercise[];
  benefits: string[];
  equipmentNotes: string | null;
  contraindications: string[];
  warmup: string[];
  cooldown: string[];
  avoidIf: string[];
  popularity: number;
}

const ex = (
  order: number,
  name: string,
  description: string,
  muscleGroups: MuscleGroup[],
  equipment: Equipment[],
  sets: number,
  reps: string,
  restSeconds: number,
  caloriesPerMinute: number,
  instructions: string[],
  tips: string[] = [],
  commonMistakes: string[] = [],
): SeedExercise => ({
  order,
  name,
  description,
  instructions,
  muscleGroups,
  equipment,
  sets,
  reps,
  restSeconds,
  durationSeconds: 45,
  caloriesPerMinute,
  tips,
  commonMistakes,
});

export const WORKOUTS: SeedWorkout[] = [
  {
    slug: 'beginner-full-body-hiit-20',
    title: 'Beginner Full Body HIIT',
    description:
      'A 20 minute full body circuit that needs no equipment. Short bouts of work with short rests keep the heart rate up while covering every major muscle group, which makes it a good first session for anyone returning to training.',
    category: 'hiit',
    difficulty: 'beginner',
    location: 'anywhere',
    equipment: ['bodyweight', 'none'],
    muscleGroups: ['full_body', 'cardio'],
    durationMinutes: 20,
    estimatedCalories: 200,
    popularity: 95,
    benefits: [
      'Improves cardiovascular fitness in a short amount of time',
      'Works the whole body in one session',
      'Burns a high number of calories per minute',
      'No equipment or changing required',
    ],
    equipmentNotes: 'You need roughly 2 square metres of clear floor space and a water bottle.',
    contraindications: [
      'Not suitable if you have uncontrolled high blood pressure',
      'Stop if you feel chest pain, dizziness or unusual breathlessness',
    ],
    warmup: [
      'March on the spot for 2 minutes, swinging your arms',
      '10 arm circles forward, 10 backward',
      '8 bodyweight squats at half speed',
    ],
    cooldown: [
      'Walk around the room for 2 minutes until breathing settles',
      'Hold a standing forward fold for 30 seconds',
      'Stretch each quad for 30 seconds per side',
    ],
    avoidIf: ['knee injury', 'ankle sprain'],
    exercises: [
      ex(1, 'Bodyweight Squat', 'A squat with the hands held in front for balance.', ['legs', 'glutes'], ['bodyweight'], 3, '12', 45, 7, [
        'Stand with feet shoulder width apart',
        'Send the hips back as if sitting into a chair',
        'Keep the chest tall and knees tracking over the toes',
        'Drive through the whole foot to stand',
      ], ['Sit lower than you think you need to and keep the heels down'], ['Knees collapsing inward', 'Heels lifting off the floor']),
      ex(2, 'Incline Push-up', 'A push-up with the hands on a chair, wall or step.', ['chest', 'arms', 'shoulders'], ['bodyweight'], 3, '8-12', 45, 7, [
        'Place hands on a stable surface slightly wider than shoulder width',
        'Walk the feet back until the body forms one straight line',
        'Lower the chest towards the surface with the elbows at 45 degrees',
        'Press away and keep the core braced',
      ], ['A slope makes the movement much easier, so use one if needed'], ['Flaring the elbows to 90 degrees', 'Hips sagging towards the floor']),
      ex(3, 'Reverse Lunge', 'A step backwards into a lunge, which is kinder to the knees than a forward lunge.', ['legs', 'glutes'], ['bodyweight'], 3, '10 each side', 45, 7, [
        'Stand tall with feet hip width apart',
        'Step one foot back and lower the back knee towards the floor',
        'Keep the front shin roughly vertical',
        'Push through the front heel to return to standing',
      ], ['Aim for a 90 degree angle at the front knee'], ['Front knee travelling past the toes', 'Losing balance and rocking forward']),
      ex(4, 'Mountain Climber', 'A fast plank with the knees driving towards the chest.', ['core', 'cardio', 'full_body'], ['bodyweight'], 3, '30 seconds', 30, 9, [
        'Start in a straight arm plank with the shoulders over the hands',
        'Drive one knee towards the chest, then the other',
        'Keep the hips level and the shoulders stacked over the wrists',
      ], ['Slow the pace down rather than losing the plank shape'], ['Hips bouncing up and down', 'Hands drifting forward of the shoulders']),
      ex(5, 'Glute Bridge', 'Lying on your back, lifting the hips.', ['glutes', 'core'], ['bodyweight', 'mat'], 3, '15', 40, 5, [
        'Lie on your back with knees bent and feet flat, close to the hips',
        'Squeeze the glutes and lift the hips until the body forms a straight line',
        'Pause for a second at the top',
        'Lower under control',
      ], ['Push through the heels, not the toes'], ['Overarching the lower back at the top', 'Rushing the lowering phase']),
      ex(6, 'Plank', 'A straight body line held from the forearms.', ['core'], ['bodyweight', 'mat'], 3, '30 seconds', 30, 4, [
        'Set the forearms on the floor with elbows under the shoulders',
        'Extend the legs behind you',
        'Squeeze the glutes and abs so the hips do not sag',
        'Breathe steadily throughout',
      ], ['If the hold is too hard, start on the knees'], ['Holding the breath', 'Hips drifting up toward the shoulders']),
    ],
  },
  {
    slug: 'home-strength-upper-body',
    title: 'Home Upper Body Strength',
    description:
      'A dumbbell-free upper body session built from pressing, pulling and carries. Uses a resistance band if you have one, and works just as well with slow bodyweight tempo if you do not.',
    category: 'upper_body',
    difficulty: 'beginner',
    location: 'home',
    equipment: ['bodyweight', 'resistance_band'],
    muscleGroups: ['chest', 'back', 'shoulders', 'arms'],
    durationMinutes: 30,
    estimatedCalories: 260,
    popularity: 88,
    benefits: [
      'Builds pushing and pulling strength',
      'Improves posture by training the upper back',
      'Needs no gym membership',
    ],
    equipmentNotes: 'A resistance band is optional. A sturdy chair or table works as a substitute for a pull-up bar.',
    contraindications: ['Stop if you feel sharp pain in the shoulder joint rather than muscle fatigue'],
    warmup: ['Arm circles for 60 seconds', '10 band pull-aparts', '10 scapular squeezes'],
    cooldown: ['Doorway chest stretch, 30 seconds per side', 'Cross-body shoulder stretch, 30 seconds per side', 'Eagle arms, 30 seconds'],
    avoidIf: ['shoulder impingement', 'rotator cuff injury'],
    exercises: [
      ex(1, 'Push-up', 'The standard horizontal press.', ['chest', 'triceps'], ['bodyweight'], 3, '8-15', 60, 7, [
        'Hands slightly wider than the shoulders, body in one straight line',
        'Lower until the chest is a fist from the floor',
        'Press away, keeping the elbows at roughly 45 degrees',
      ], ['Start on the knees and graduate as reps become easy'], ['Flaring elbows straight out to the sides', 'Head dropping toward the floor first']),
      ex(2, 'Bent-over Row', 'A hip hinge with a row, the main builder of the upper back.', ['back', 'arms'], ['bodyweight', 'resistance_band'], 4, '10-12', 75, 6, [
        'Hinge at the hips until the torso is around 45 degrees',
        'Pull the elbows toward the hips, squeezing the shoulder blades',
        'Lower slowly for 3 seconds',
      ], ['Imagine pulling the elbows into your back pockets'], ['Rounding the lower back during the hinge', 'Shrugging the shoulders up toward the ears']),
      ex(3, 'Pike Push-up', 'An overhead press done at an angle, the closest thing to a press-up without a bar.', ['shoulders', 'arms'], ['bodyweight'], 3, '6-12', 60, 7, [
        'From a plank, walk the feet in and lift the hips into an inverted V',
        'Lower the crown of the head towards the floor',
        'Press back up',
      ], ['Use a chair seat for an easier version'], ['Letting the hips drop toward the head', 'Pressing off the toes with locked ankles']),
      ex(4, 'Band Pulldown', 'Simulates a lat pulldown with a band.', ['back', 'arms'], ['resistance_band'], 3, '12-15', 45, 5, [
        'Loop the band around a high anchor point at arm height',
        'Kneel and hold the band with an overhand grip',
        'Pull down to the chest, letting the shoulder blades draw together',
      ], ['Use a towel loop to get more range if the band is short'], ['Leaning back to move the weight', 'Shrugging at the top of the pull']),
      ex(5, 'Plank Shoulder Tap', 'An anti-rotation challenge for the core.', ['core', 'shoulders'], ['bodyweight', 'mat'], 3, '12 each side', 40, 5, [
        'Set up in a straight arm plank',
        'Lift one hand and tap the opposite shoulder',
        'Return the hand and repeat on the other side',
      ], ['Widen the feet slightly to make it more stable'], ['Hips rocking side to side', 'Rushing the taps']),
      ex(6, 'Farmer Carry', 'Loaded carries for grip, posture and traps.', ['core', 'shoulders', 'full_body'], ['bodyweight'], 3, '40 metres', 60, 6, [
        'Hold a weight in each hand at your sides',
        'Walk with short, controlled steps',
        'Keep the ribs stacked over the pelvis and shoulders back',
      ], ['Go lighter and walk longer rather than heavier and shorter'], ['Leaning to one side', 'Shrugging with tension in the neck']),
    ],
  },
  {
    slug: 'beginner-home-cardio-hiit',
    title: 'Home Cardio Burner',
    description:
      'Twelve minutes of continuous movement that raises the heart rate without needing a single piece of equipment. Ideal on a busy day when a full workout is unrealistic.',
    category: 'cardio',
    difficulty: 'beginner',
    location: 'home',
    equipment: ['bodyweight'],
    muscleGroups: ['cardio', 'full_body'],
    durationMinutes: 12,
    estimatedCalories: 130,
    popularity: 92,
    benefits: ['Quick cardiovascular lift', 'Minimal joint impact at low intensity', 'Energising without leaving the house'],
    equipmentNotes: null,
    contraindications: ['Take extra recovery if you are pregnant or recently postpartum'],
    warmup: ['2 minutes of easy marching'],
    cooldown: ['2 minutes of slow walking, then gentle calf and hamstring stretches'],
    avoidIf: [],
    exercises: [
      ex(1, 'March', 'Alternating knee lifts at a steady rhythm.', ['cardio'], ['bodyweight'], 1, '40 seconds', 20, 6, [
        'Stand tall and lift one knee to hip height',
        'Swing the opposite arm forward',
        'Alternate sides without stopping',
      ], ['Keep the pace conversational rather than sprinting'], ['Landing flat-footed and heavy']),
      ex(2, 'Squat to Reach', 'A squat that finishes with an overhead reach.', ['legs', 'cardio'], ['bodyweight'], 1, '40 seconds', 20, 8, [
        'Squat down to about chair height',
        'Drive up and reach both arms overhead',
        'Lower the arms as you descend into the next rep',
      ], [], ['Stopping the squat halfway up']),
      ex(3, 'Step Touch', 'A side-to-side step with an arm swing.', ['cardio'], ['bodyweight'], 1, '40 seconds', 20, 6, [
        'Step one foot out and bring the other foot across to tap behind',
        'Swing the arms as you step',
        'Alternate sides continuously',
      ], [], ['Feet dragging on the floor']),
      ex(4, 'Reverse Lunge', 'Alternating lunges to work the legs.', ['legs', 'glutes'], ['bodyweight'], 1, '40 seconds', 20, 8, [
        'Step back and lower until the back knee is close to the floor',
        'Push through the front heel to return',
        'Alternate legs every rep',
      ], [], ['Knee of the front leg going past the toes']),
      ex(5, 'Star Jump', 'A low-impact-sounding jump that keeps the intensity high.', ['cardio', 'full_body'], ['bodyweight'], 1, '40 seconds', 20, 10, [
        'Jump both feet wide while bringing the hands overhead',
        'Jump back to the start position',
        'Keep the landings soft',
      ], ['Step one foot out and the other in instead of jumping if impact is a concern'], ['Landing with locked knees', 'Slouching in the standing position']),
      ex(6, 'Standing Knee to Elbow', 'A rotation that trains the obliques.', ['core', 'cardio'], ['bodyweight'], 1, '40 seconds', 20, 7, [
        'Stand tall and bring the right knee up to meet the left elbow',
        'Switch sides each rep',
        'Keep the hips square to the front',
      ], [], ['Swinging the elbow wildly across the body']),
    ],
  },
  {
    slug: 'intermediate-push-pull-lower',
    title: 'Push / Pull Strength Split',
    description:
      'A classic intermediate split: heavy compound pushing work followed by pulling volume. Best done two to three times a week with rest days between.',
    category: 'strength',
    difficulty: 'intermediate',
    location: 'gym',
    equipment: ['barbell', 'dumbbell', 'bench', 'pull_up_bar'],
    muscleGroups: ['chest', 'back', 'shoulders', 'arms'],
    durationMinutes: 50,
    estimatedCalories: 420,
    popularity: 84,
    benefits: [
      'Builds upper body strength with proven progressions',
      'Balances pushing and pulling to avoid muscular imbalance',
      'Scales well as strength improves',
    ],
    equipmentNotes: 'A barbell and a flat bench are strongly recommended. Dumbbells are a good substitute for the pressing work.',
    contraindications: ['Get a spotter for the barbell compounds if you are new to lifting'],
    warmup: ['5 minutes of light cardio', '2 empty bar warm-up sets before the first working set', 'Band pull-aparts and shoulder circles'],
    cooldown: ['Lat stretch against a rack for 45 seconds per side', 'Chest stretch on the bar for 45 seconds', 'Arms across the chest'],
    avoidIf: ['shoulder impingement', 'lower back injury'],
    exercises: [
      ex(1, 'Barbell Bench Press', 'The primary horizontal press.', ['chest', 'triceps', 'shoulders'], ['barbell', 'bench'], 4, '5-8', 150, 8, [
        'Lie with the eyes under the bar and the shoulder blades pinned down',
        'Grip just outside shoulder width',
        'Lower to the lower chest, keeping the elbows under the bar',
        'Press up and slightly back toward the shoulders',
      ], ['Leave one or two reps in reserve rather than grinding to failure'], ['Bouncing the bar off the chest', 'Flaring the elbows to 90 degrees', 'Hips coming off the bench']),
      ex(2, 'Overhead Press', 'A strict standing press.', ['shoulders', 'triceps'], ['barbell'], 4, '5-8', 150, 8, [
        'Set the bar at the collarbone with the forearms vertical',
        'Squeeze the glutes and brace the core',
        'Press the bar up and slightly back over the mid-foot',
        'Lock out without leaning back',
      ], ['Squeeze the glutes to stop the lower back arching'], ['Pressing the bar in front of the face', 'Leaning back to shift the load']),
      ex(3, 'Weighted Dips', 'A bodyweight press for the chest and triceps.', ['chest', 'triceps'], ['bodyweight', 'none'], 3, '6-10', 90, 9, [
        'Support yourself between parallel bars with the arms straight',
        'Lower until the upper arms are near horizontal',
        'Press back up to a lockout',
      ], ['Use an assisted or bodyweight version if 6 reps is too few'], ['Dropping too low and stressing the shoulder', 'Flaring the elbows forward']),
      ex(4, 'Pull-up or Lat Pulldown', 'Vertical pulling for the lats and upper back.', ['back', 'arms'], ['pull_up_bar', 'none'], 4, '6-10', 120, 8, [
        'Hang from the bar with an overhand grip slightly wider than the shoulders',
        'Pull the chest towards the bar with the elbows driving down',
        'Lower under control to a full hang',
      ], ['Use a lat pulldown machine or band assistance when needed'], ['Kipping and swinging', 'Pulling to the neck rather than the chest']),
      ex(5, 'Barbell Row', 'Horizontal pulling for the mid back.', ['back', 'arms'], ['barbell'], 4, '8-10', 120, 7, [
        'Bend the knees and hinge until the torso is around 45 degrees',
        'Pull the bar to the lower ribs, leading with the elbows',
        'Lower slowly to a full stretch',
      ], ['Keep the bar close to the legs the whole time'], ['Rounding the back under load', 'Shrugging the shoulders upward']),
      ex(6, 'Face Pull', 'Directs work at the rear delts and rotator cuff.', ['shoulders', 'back'], ['resistance_band'], 3, '15-20', 60, 4, [
        'Set a band at chest height and hold it with both hands',
        'Pull the hands towards the face, rotating them apart at the end',
        'Pause with the hands beside the ears',
      ], ['The most valuable 3 sets in most shoulder programs'], ['Pulling with the arms only and ignoring the rotation']),
    ],
  },
  {
    slug: 'lower-body-strength-dumbbell',
    title: 'Lower Body Strength with Dumbbells',
    description:
      'Builds the legs without needing a squat rack. Dumbbells let the load be adjusted as strength improves, and the programme works for beginners and intermediates alike.',
    category: 'lower_body',
    difficulty: 'intermediate',
    location: 'anywhere',
    equipment: ['dumbbell', 'bodyweight'],
    muscleGroups: ['legs', 'glutes'],
    durationMinutes: 40,
    estimatedCalories: 340,
    popularity: 80,
    benefits: ['Develops the largest muscles in the body', 'Improves knee and hip strength', 'Raises day to day calorie burn'],
    equipmentNotes: 'Two dumbbells of equal weight. A backpack with books works for a home version.',
    contraindications: ['Stop if you feel sharp pain in the knee or hip'],
    warmup: ['3 minutes of marching', '10 bodyweight squats', '10 reverse lunges', '10 glute bridges'],
    cooldown: ['Standing quad stretch 30 seconds per side', 'Pigeon stretch 45 seconds per side', 'Hamstring stretch 30 seconds per side'],
    avoidIf: ['knee injury', 'hip injury', 'ankle sprain'],
    exercises: [
      ex(1, 'Goblet Squat', 'A squat that stays upright and easy to load.', ['quads', 'glutes'], ['dumbbell'], 4, '8-10', 90, 8, [
        'Hold one dumbbell vertically against the chest with both hands',
        'Sit down between the hips, keeping the chest up',
        'Drive through the whole foot to stand',
      ], ['Sit between the hips rather than back', 'Keep the elbows inside the knees'], ['Knees caving inward', 'Rounding the lower back']),
      ex(2, 'Romanian Deadlift', 'Hinge work that builds the hamstrings and glutes.', ['hamstrings', 'glutes', 'back'], ['dumbbell'], 4, '8-10', 90, 7, [
        'Stand tall with a dumbbell in each hand in front of the thighs',
        'Push the hips back and let the weights slide down the legs',
        'Stop when a strong hamstring stretch is felt',
        'Drive the hips forward to stand',
      ], ['The weight is a lever for the hinge, not the point of the exercise'], ['Squatting instead of hinging', 'Rounding the back as the weight passes the knees']),
      ex(3, 'Bulgarian Split Squat', 'Single leg work that exposes side to side imbalances.', ['legs', 'glutes'], ['dumbbell', 'bodyweight'], 3, '10 each side', 75, 9, [
        'Rest the rear foot on a chair behind you',
        'Lower the back knee towards the floor',
        'Drive through the front heel to stand',
      ], ['Move the front foot further forward if balance is an issue'], ['Front heel lifting', 'Hips twisting toward the working leg']),
      ex(4, 'Hip Thrust', 'A direct glute builder.', ['glutes'], ['dumbbell', 'mat'], 4, '12-15', 75, 6, [
        'Sit with the shoulder blades against a bench and the feet flat',
        'Rest the dumbbell across the hips',
        'Drive the hips up until the body forms a straight line',
        'Pause, then lower',
      ], ['Tuck the chin slightly to keep the neck long'], ['Overarching the lower back at the top']),
      ex(5, 'Walking Lunge', 'A dynamic single leg movement.', ['legs', 'glutes', 'cardio'], ['dumbbell'], 3, '12 steps each leg', 60, 8, [
        'Step forward into a deep lunge',
        'Bring the back leg through into the next lunge',
        'Keep the torso upright throughout',
      ], [], ['Leaning too far forward']),
      ex(6, 'Standing Calf Raise', 'Ankle strength, which matters for running and jumping.', ['legs'], ['bodyweight', 'dumbbell'], 3, '20', 45, 3, [
        'Stand tall with the feet hip width apart',
        'Rise onto the balls of the feet as high as possible',
        'Pause for a second at the top',
        'Lower slowly through the full range',
      ], [], ['Bouncing out of the bottom position']),
    ],
  },
  {
    slug: 'core-20-minute',
    title: '20 Minute Core Circuit',
    description:
      'A focused core session that trains the deep stabilisers, the abdominals and the obliques, in the order that keeps the lower back safe.',
    category: 'core',
    difficulty: 'beginner',
    location: 'anywhere',
    equipment: ['bodyweight', 'mat'],
    muscleGroups: ['core'],
    durationMinutes: 20,
    estimatedCalories: 160,
    popularity: 90,
    benefits: ['Improves posture and spinal stability', 'Reduces lower back discomfort', 'Makes every other lift safer'],
    equipmentNotes: 'A mat is recommended but a folded towel works.',
    contraindications: ['Stop if you feel any sharp lower back pain'],
    warmup: ['Cat-cow for 10 slow repetitions', 'Bird dogs for 8 each side', '90/90 hip switches for 30 seconds'],
    cooldown: ['Child pose for 60 seconds', 'Supine spinal twist 45 seconds per side', 'Knee to chest 30 seconds each side'],
    avoidIf: ['lower back injury', 'herniated disc'],
    exercises: [
      ex(1, 'Dead Bug', 'Teaches the deep core to stay still while the limbs move.', ['core'], ['mat'], 3, '10 each side', 40, 4, [
        'Lie on the back with the arms pointing at the ceiling and knees over hips',
        'Press the lower back gently into the floor',
        'Lower the opposite arm and leg without letting the back arch',
        'Return and swap sides',
      ], ['If the back lifts, reduce the range of the leg'], ['Arching the lower back', 'Rushing the reps']),
      ex(2, 'Plank', 'An isometric hold for the front of the core.', ['core'], ['bodyweight', 'mat'], 3, '45 seconds', 40, 4, [
        'Set the forearms under the shoulders and extend the legs',
        'Squeeze the glutes and draw the navel towards the spine',
        'Hold while breathing steadily',
      ], ['Drop to the knees at any point rather than sagging'], ['Hips too high or too low', 'Holding the breath']),
      ex(3, 'Side Plank', 'Targets the obliques and the hip stabilisers.', ['core'], ['mat'], 3, '30 seconds each side', 40, 4, [
        'Lie on one side with the elbow under the shoulder',
        'Stack the feet or stagger them for more stability',
        'Lift the hips so the body forms one line',
      ], ['Bend the bottom knee if the full version is too hard'], ['Hips sinking towards the floor', 'Neck craning to look forward']),
      ex(4, 'Bird Dog', 'Anti-extension work for the lower back.', ['core', 'back'], ['mat'], 3, '10 each side', 40, 4, [
        'Start on all fours with the hands under the shoulders',
        'Extend the opposite arm and leg until both are in line with the spine',
        'Hold for 2 seconds and return',
      ], [], ['Hip rotating open toward the ceiling']),
      ex(5, 'Russian Twist', 'Rotational strength for the obliques.', ['core'], ['bodyweight', 'mat'], 3, '20 total', 45, 6, [
        'Sit with the knees bent and lean back to around 45 degrees',
        'Rotate the torso to tap the floor beside each hip',
        'Keep the chest open rather than hunching',
      ], ['Lift the feet off the floor to make it harder'], ['Rounding the back', 'Swinging the arms only']),
      ex(6, 'Hollow Hold', 'A gymnastic staple that also works the upper back.', ['core'], ['mat'], 3, '30 seconds', 45, 5, [
        'Lie on the back and press the lower back into the floor',
        'Lift the shoulder blades and legs off the floor',
        'Extend the arms overhead and hold',
      ], ['Bend the knees to reduce the difficulty'], ['Lower back arching off the floor']),
    ],
  },
  {
    slug: 'mobility-morning-flow',
    title: 'Morning Mobility Flow',
    description:
      'A gentle sequence for the first ten minutes of the day. It moves every major joint through its full range and finishes feeling looser rather than fatigued.',
    category: 'mobility',
    difficulty: 'beginner',
    location: 'anywhere',
    equipment: ['bodyweight', 'mat'],
    muscleGroups: ['full_body'],
    durationMinutes: 15,
    estimatedCalories: 70,
    popularity: 79,
    benefits: ['Reduces stiffness from sleeping', 'Improves joint range of motion', 'Makes training safer later in the day'],
    equipmentNotes: null,
    contraindications: [],
    warmup: ['The whole sequence is the warmup'],
    cooldown: ['Finish with a 60 second savasana lying flat'],
    avoidIf: [],
    exercises: [
      ex(1, 'Cat-Cow', 'Mobilises the whole spine in both directions.', ['back', 'core'], ['mat'], 2, '10 slow reps', 10, 3, [
        'Start on all fours with the hands under the shoulders',
        'Inhale and drop the belly, lifting the chest and tailbone',
        'Exhale and round the spine, tucking the chin',
      ], [], ['Rushing through the range']),
      ex(2, "World's Greatest Stretch", 'A hip, hamstring and thoracic rotation in one.', ['legs', 'back'], ['mat'], 2, '5 each side', 10, 4, [
        'Step into a deep lunge with the hands inside the front foot',
        'Drop the back knee and rotate the inside arm up toward the ceiling',
        'Follow the raised hand with your eyes',
      ], [], ['Forgetting to look at the raised hand']),
      ex(3, 'Downward Dog', 'Lengthens the calves, hamstrings and back.', ['legs', 'shoulders', 'back'], ['bodyweight', 'mat'], 2, '45 seconds', 15, 4, [
        'Start in a plank and lift the hips up and back',
        'Bend the knees as much as needed to lengthen the spine',
        'Press the floor away with the hands',
      ], ['Bend the knees rather than forcing straight legs'], ['Hinging at the waist instead of the hips']),
      ex(4, '90/90 Hip Switch', 'Rotates the hips through both sides.', ['legs'], ['mat'], 2, '10 switches', 10, 3, [
        'Sit with both knees bent to 90 degrees',
        'Rotate both knees to one side, then the other',
        'Keep the hands down for support',
      ], [], ['Hips lifting off the floor']),
      ex(5, 'Thread the Needle', 'Opens the mid back and shoulders.', ['back', 'shoulders'], ['mat'], 2, '5 each side', 10, 3, [
        'Start on all fours and thread one arm under the opposite arm',
        'Rest the shoulder and head on the floor',
        'Rotate the top arm up towards the ceiling',
      ], [], ['Forcing the shoulder to the floor']),
      ex(6, 'Deep Squat Hold', 'Restores ankle and hip range.', ['legs'], ['bodyweight', 'mat'], 2, '60 seconds', 15, 3, [
        'Stand with the feet a little wider than the hips',
        'Sit down between the heels, heels as close to the floor as possible',
        'Hold onto the ankles if needed and breathe',
      ], ['Elevate the heels on a rolled towel to make it accessible'], ['Heels lifting off the floor']),
    ],
  },
  {
    slug: 'mobility-evening-unwind',
    title: 'Evening Unwind Routine',
    description:
      'A slow wind-down for the end of the day. Long holds, no explosive movements, and a deliberate focus on the muscles that tighten from sitting.',
    category: 'stretching',
    difficulty: 'beginner',
    location: 'anywhere',
    equipment: ['mat', 'resistance_band'],
    muscleGroups: ['full_body'],
    durationMinutes: 20,
    estimatedCalories: 90,
    popularity: 83,
    benefits: ['Helps unwind after a long day', 'Releases tight hips and hamstrings', 'Improves sleep quality when done before bed'],
    equipmentNotes: 'A band makes the shoulder stretch deeper. No equipment is fine.',
    contraindications: ['Skip any stretch that causes joint pain, not muscle stretch'],
    warmup: ['2 minutes of slow walking in place'],
    cooldown: ['This routine is entirely cooldown work'],
    avoidIf: [],
    exercises: [
      ex(1, 'Pigeon Pose', 'A deep hip stretch for glutes and piriformis.', ['glutes', 'legs'], ['mat'], 2, '90 seconds each side', 15, 3, [
        'From all fours, bring one knee forward and extend the other leg back',
        'Square the hips as far as comfortable',
        'Fold forward and rest on the forearms',
      ], ['Use a pillow under the hip to reduce the intensity'], ['Forcing the hips square to the floor']),
      ex(2, 'Hamstring Stretch with Band', 'Reaches the hamstrings with gentle tension.', ['legs'], ['resistance_band', 'mat'], 2, '60 seconds each side', 15, 3, [
        'Lie on the back and loop the band around the foot',
        'Extend the leg until a light stretch is felt',
        'Draw the toes gently towards the body',
      ], ['A towel works instead of a band'], ['Pulling hard enough to feel behind the knee']),
      ex(3, 'Supine Twist', 'Rotational release for the lower back.', ['core', 'back'], ['mat'], 2, '60 seconds each side', 10, 2, [
        'Lie on the back with the arms out in a T',
        'Draw one knee across the body and let the shoulder stay down',
        'Breathe into the twist',
      ], [], ['Both shoulders lifting off the floor']),
      ex(4, 'Figure Four Stretch', 'Targets the piriformis and deep glutes.', ['glutes'], ['mat'], 2, '60 seconds each side', 10, 2, [
        'Lie on the back, cross one ankle over the opposite knee',
        'Pull the supporting thigh towards the chest',
        'Keep the head and shoulders relaxed on the floor',
      ], [], ['Hips curling up off the floor']),
      ex(5, 'Child Pose with Side Stretch', 'A back and side body release.', ['back'], ['mat'], 2, '60 seconds each side', 10, 2, [
        'Kneel and sit the hips towards the heels',
        'Walk the hands to one side to stretch the opposite side of the back',
        'Breathe slowly into the back',
      ], [], ['Holding the breath']),
      ex(6, 'Legs Up the Wall', 'A passive inversion that reduces leg heaviness.', ['legs'], ['mat'], 1, '3 minutes', 10, 2, [
        'Lie with the hips close to a wall and the legs up the wall',
        'Rest the arms out to the sides and close the eyes',
        'Breathe slowly for three minutes',
      ], ['A pillow under the hips makes the position easier'], ['Keeping the legs tense instead of letting them flop']),
    ],
  },
  {
    slug: 'advanced-conditional-hiit-25',
    title: 'Power HIIT 25',
    description:
      'An advanced conditioning session using long and short work intervals. It targets the aerobic and anaerobic systems together, and needs good recovery habits around it.',
    category: 'hiit',
    difficulty: 'advanced',
    location: 'anywhere',
    equipment: ['bodyweight', 'none'],
    muscleGroups: ['cardio', 'full_body'],
    durationMinutes: 25,
    estimatedCalories: 320,
    popularity: 76,
    benefits: ['Highest calorie burn of any session here', 'Improves VO2 max', 'Builds anaerobic capacity'],
    equipmentNotes: 'Clear floor space and a timer. This is hard work by design.',
    contraindications: [
      'Not for beginners or anyone with a heart condition',
      'Stop immediately if you develop chest pain or faintness',
    ],
    warmup: ['5 minutes of continuous movement: jumping jacks, high knees, butt kicks, squat to reach'],
    cooldown: ['3 minutes of walking or a light jog', 'Full body static stretch, 30 seconds per area'],
    avoidIf: ['heart condition', 'high blood pressure', 'recent injury', 'pregnancy'],
    exercises: [
      ex(1, 'Burpee', 'The full body conditioning standard.', ['full_body', 'cardio'], ['bodyweight'], 4, '40 seconds', 20, 12, [
        'From standing, squat down and place the hands on the floor',
        'Jump or step the feet back into a plank',
        'Return the feet and jump up with the arms overhead',
      ], ['Scale to step-back burpees until the jump version is easy'], ['Skipping the plank and bouncing straight up']),
      ex(2, 'High Knees', 'A fast sprint in place.', ['cardio', 'legs'], ['bodyweight'], 4, '40 seconds', 20, 11, [
        'Drive one knee to hip height at a sprint',
        'Switch legs rapidly',
        'Stay on the balls of the feet',
      ], [], ['Heels dragging on the floor']),
      ex(3, 'Jump Squat', 'Explosive lower body power.', ['legs', 'cardio'], ['bodyweight'], 4, '40 seconds', 25, 12, [
        'Squat down until the thighs are below parallel',
        'Explode up into a jump',
        'Land softly and immediately drop into the next rep',
      ], ['Use a pause squat instead to keep the training quality high'], ['Landing with straight knees', 'Half reps that stop at the top']),
      ex(4, 'Mountain Climber', 'Fast core work that keeps the heart rate high.', ['core', 'cardio'], ['bodyweight'], 4, '40 seconds', 20, 10, [
        'Hold a straight arm plank',
        'Drive the knees to the chest in quick alternation',
        'Keep the shoulders over the hands',
      ], [], ['Hips bouncing rather than holding still']),
      ex(5, 'Split Lunge Jump', 'An explosive single leg movement.', ['legs', 'cardio'], ['bodyweight'], 4, '40 seconds', 25, 12, [
        'Jump into a split stance, absorbing the landing quietly',
        'Switch legs in the air and land in the opposite split',
      ], ['Step instead of jumping if the impact is too much'], ['Knees landing beyond the toes', 'Loud, heavy landings indicating fatigue']),
      ex(6, 'Tuck Jump', 'A maximal power and conditioning movement.', ['cardio', 'full_body'], ['bodyweight'], 4, '40 seconds', 30, 13, [
        'Jump and tuck both knees towards the chest',
        'Extend the legs and land softly',
      ], ['Replace with a tuck hold if the impact is uncomfortable'], ['Landing stiff-legged']),
    ],
  },
  {
    slug: 'outdoor-5k-interval-run',
    title: 'Outdoor 5K Interval Run',
    description:
      'A structured interval session for someone who already runs. Alternating hard efforts and easy recovery builds endurance without the boredom of steady state running.',
    category: 'cardio',
    difficulty: 'intermediate',
    location: 'outdoor',
    equipment: ['none'],
    muscleGroups: ['cardio', 'legs'],
    durationMinutes: 35,
    estimatedCalories: 420,
    popularity: 71,
    benefits: ['Builds running economy', 'Improves speed at the aerobic threshold', 'Runs outdoors, which lifts mood further'],
    equipmentNotes: 'Shoes with proper support. A watch or phone for the interval timings is helpful but not required.',
    contraindications: [
      'Not suitable if you are new to running',
      'Reduce the interval length in hot conditions',
    ],
    warmup: ['5 minutes of easy walking, then 3 minutes of easy jogging', '4 x 20 second strides with 60 seconds easy jog between'],
    cooldown: ['5 minutes of easy jogging to bring the heart rate down', 'Calf and hamstring stretches'],
    avoidIf: ['shin splints', 'knee injury', 'heat illness'],
    exercises: [
      ex(1, 'Easy Jog', 'Recovery pace, conversational and relaxed.', ['cardio', 'legs'], ['none'], 1, '2 minutes between efforts', 0, 8, [
        'Run at an effort where you could hold a conversation',
        'Keep the strides short and the turnover quick',
      ], ['If you cannot talk, slow down'], ['Sprinting the recovery sections']),
      ex(2, 'Hard Effort', 'A sustained hard pace, roughly 5K race effort.', ['cardio', 'legs'], ['none'], 1, '3 minutes, 4 times', 120, 12, [
        'Settle into a rhythm over the first 30 seconds',
        'Hold the pace with relaxed shoulders and a slight forward lean',
        'Run tall, not leaning forward from the waist',
      ], ['Even effort across all 3 minutes matters more than speed'], ['Fading in the final minute of each effort']),
      ex(3, 'Float', 'An easy recovery jog.', ['cardio'], ['none'], 1, '2 minutes', 0, 7, [
        'Jog very gently until breathing is controlled again',
        'This is recovery, not a slower hard effort',
      ], [], ['Standing still rather than jogging if that is what recovery needs']),
      ex(4, 'Strides', 'Short relaxed accelerations that teach good running form.', ['cardio', 'legs'], ['none'], 1, '6 x 20 seconds', 60, 11, [
        'Build up to about 90 percent over 20 seconds',
        'Relax completely for the 60 seconds that follow',
        'Focus on a quick, light foot strike',
      ], ['The effort should feel smooth, not maximal'], ['Trying to sprint and running out of steam']),
    ],
  },
  {
    slug: 'posture-desk-reset',
    title: 'Desk Posture Reset',
    description:
      'Ten minutes aimed directly at the neck, shoulders and upper back problems that come from long hours at a desk. No equipment, no changing clothes, and easy to do in a small space.',
    category: 'mobility',
    difficulty: 'beginner',
    location: 'home',
    equipment: ['bodyweight', 'none'],
    muscleGroups: ['shoulders', 'back', 'core'],
    durationMinutes: 10,
    estimatedCalories: 45,
    popularity: 87,
    benefits: ['Eases neck and shoulder stiffness', 'Rebuilds awareness of a neutral posture', 'Fits into a short break'],
    equipmentNotes: 'A chair is needed. A desk edge is useful for one exercise.',
    contraindications: [],
    warmup: ['The first two movements act as the warmup'],
    cooldown: ['Lie face down on the floor for 2 minutes if that is comfortable'],
    avoidIf: [],
    exercises: [
      ex(1, 'Chin Tuck', 'Restores the forward head position.', ['shoulders'], ['none'], 3, '10', 20, 2, [
        'Sit tall with the eyes level',
        'Draw the chin straight back, making a double chin',
        'Hold for 3 seconds and release',
      ], ['The movement is small; bigger is not better'], ['Looking down while doing it']),
      ex(2, 'Wall Angel', 'Opens the chest and trains upright posture.', ['shoulders', 'back'], ['none'], 3, '8', 40, 3, [
        'Stand with the back, back of head and hands against a wall',
        'Slide the arms up the wall as far as is comfortable',
        'Lower and repeat, keeping the ribs down',
      ], ['Slide the hands as far as they go without arching the back'], ['Lower back arching away from the wall']),
      ex(3, 'Thoracic Rotation', 'Restores rotation to the mid back.', ['back'], ['mat'], 3, '8 each side', 20, 3, [
        'Sit sideways on the chair with the feet planted',
        'Rotate the torso towards the back of the chair, following with the eyes',
        'Return and swap',
      ], [], ['Rotating only the lower back']),
      ex(4, 'Seated Row', 'Strengthens the muscles that hold the shoulders back.', ['back'], ['resistance_band', 'none'], 3, '12', 45, 3, [
        'Loop a band around the chair legs and hold with an overhand grip',
        'Sit tall and pull the elbows back, squeezing the shoulder blades',
        'Return slowly',
      ], ['Without a band, imagine pulling a rope to open a door'], ['Slouching into the chair as the elbows go back']),
      ex(5, 'Doorway Pec Stretch', 'Counters the rounded shoulders of desk work.', ['shoulders', 'chest'], ['none'], 3, '45 seconds each side', 20, 2, [
        'Place the forearm on a door frame at shoulder height',
        'Step gently forward until the chest is stretched',
        'Keep the ribs down and the neck long',
      ], ['Stop at a stretch, never at pain'], ['Arching the lower back to increase the stretch']),
      ex(6, 'Neck Side Stretch', 'Relieves the upper trapezius.', ['shoulders'], ['none'], 3, '40 seconds each side', 15, 2, [
        'Sit tall and let the right ear drift towards the right shoulder',
        'Rest the hand lightly on the head, without pulling',
        'Breathe and release',
      ], ['Never pull the head with force'], ['Shrugging the opposite shoulder up']),
    ],
  },
];
