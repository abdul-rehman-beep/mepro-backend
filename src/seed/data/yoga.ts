/**
 * Yoga routine catalogue.
 *
 * Asana holds are conservative and widely used; the safety notes matter more
 * than the sequence. Anyone with a specific injury should follow the
 * contraindications listed on the routine and consult a professional.
 */

import type { FitnessLevel, YogaCategory } from '../../types/enums';

export interface SeedAsana {
  order: number;
  name: string;
  sanskritName: string;
  description: string;
  instructions: string[];
  benefits: string[];
  precautions: string[];
  modifications: string[];
  holdSeconds: number;
  side: 'single' | 'both' | 'none';
}

export interface SeedYoga {
  slug: string;
  title: string;
  description: string;
  category: YogaCategory;
  difficulty: FitnessLevel;
  durationMinutes: number;
  level: string;
  asanas: SeedAsana[];
  benefits: string[];
  precautions: string[];
  contraindications: string[];
  bestTimeOfDay: 'morning' | 'evening' | 'anytime';
  focusAreas: string[];
  popularity: number;
}

const asana = (
  order: number,
  name: string,
  sanskritName: string,
  description: string,
  holdSeconds: number,
  side: 'single' | 'both' | 'none',
  instructions: string[],
  benefits: string[],
  precautions: string[] = [],
  modifications: string[] = [],
): SeedAsana => ({
  order,
  name,
  sanskritName,
  description,
  instructions,
  benefits,
  precautions,
  modifications,
  holdSeconds,
  side,
});

export const YOGA_ROUTINES: SeedYoga[] = [
  {
    slug: 'morning-sun-salutation-energiser',
    title: 'Morning Sun Salutation Energiser',
    description:
      'A flowing sequence of sun salutations that raises the body temperature, wakes up the spine and takes about twelve minutes. The classic way to start a day.',
    category: 'morning',
    difficulty: 'beginner',
    durationMinutes: 12,
    level: 'beginner',
    bestTimeOfDay: 'morning',
    focusAreas: ['full body', 'spinal mobility', 'breath'],
    popularity: 93,
    benefits: [
      'Raises core temperature and circulation',
      'Mobilises every major joint through its full range',
      'Follows the breath, which calms the nervous system',
      'Takes under 15 minutes',
    ],
    precautions: [
      'Move slowly through the sequence; the breath leads, not the other way round',
      'Skip the low plank entirely if the wrists or shoulders object',
    ],
    contraindications: [
      'Avoid with uncontrolled high blood pressure, as the inversions raise pressure',
      'Modify the plank and chaturanga if you have wrist or shoulder injuries',
    ],
    asanas: [
      asana(1, 'Mountain Pose', 'Tadasana', 'Standing tall, feet rooted, breath settled.', 40, 'none', [
        'Stand with the feet hip width apart and the weight even across both feet',
        'Lift and spread the toes, then settle them back down',
        'Lengthen through the crown of the head, ribs down over the pelvis',
        'Take five slow breaths',
      ], ['Grounding', 'Postural awareness'], ['Do not lock the knees'], ['Stand with the back against a wall for support']),
      asana(2, 'Forward Fold', 'Uttanasana', 'A standing fold with a long spine.', 30, 'none', [
        'Hinge forward from the hips, keeping the front of the thighs back',
        'Bend the knees as much as needed to lengthen the spine',
        'Let the head hang heavy between the arms',
        'Half lift with a flat back, then fold again',
      ], ['Lengthens the spine', 'Calms the nervous system'], ['Never force the knees straight with a hamstring pull'], ['Bend the knees fully, or rest the hands on blocks']),
      asana(3, 'Plank Pose', 'Phalakasana', 'A straight line from heels to head.', 30, 'none', [
        'Place the hands under the shoulders and step back to the toes',
        'Press the floor away and draw the navel inwards',
        'Lengthen the tailbone towards the heels',
      ], ['Builds core stability', 'Prepares the upper body for chaturanga'], ['Hold only as long as the lower back stays flat'], ['Lower the knees to the floor']),
      asana(4, 'Cobra Pose', 'Bhujangasana', 'A gentle backbend to counter the plank.', 25, 'none', [
        'Lie face down with the hands beside the ribs',
        'Press the tops of the feet and pubic bone into the floor',
        'Peel the chest up, keeping the elbows slightly bent',
        'Lengthen the tailbone towards the heels rather than dropping it',
      ], ['Opens the front body', 'Strengthens the spinal extensors'], ['Keep the elbows bent and shoulders relaxed'], ['Rest the forearms on the floor for a lower version']),
      asana(5, 'Downward Dog', 'Adho Mukha Svanasana', 'An inverted V, the rest position of the sequence.', 45, 'none', [
        'Tuck the toes and lift the hips up and back',
        'Press the heels down if the calves allow',
        'Bend the knees a little to lengthen the spine',
        'Take five long breaths here',
      ], ['Lengthens the whole back body', 'Decompresses the spine'], ['Pedal the feet if the calves are tight'], ['Bend the knees deeply, or do a wall variation']),
      asana(6, 'Warrior I', 'Virabhadrasana I', 'A standing posture that builds leg and hip endurance.', 30, 'both', [
        'Step the right foot between the hands and angle the back foot out slightly',
        'Bend the front knee over the ankle, keeping the back leg straight',
        'Raise the arms overhead and look slightly up',
        'Hold, then repeat on the left',
      ], ['Strengthens the legs', 'Opens the hips and chest'], ['Front knee tracking over the middle of the foot'], ['Shorten the stance and soften the front knee']),
      asana(7, 'Triangle Pose', 'Trikonasana', 'A standing side stretch.', 30, 'both', [
        'From a wide stance, turn the right foot out',
        'Reach the right hand down the shin or to a block',
        'Extend the left arm up and open the chest',
        'Gaze up at the top hand if the neck allows',
      ], ['Stretches the hamstrings and side body', 'Improves lateral flexibility'], ['Do not hinge into the front knee'], ['Use a block and keep the hand on the hip']),
      asana(8, 'Child Pose', 'Balasana', 'The closing rest of the sequence.', 60, 'none', [
        'Kneel and bring the big toes together, knees wide',
        'Sit the hips back towards the heels',
        'Fold forward, arms long or alongside the body',
        'Breathe into the back for eight slow breaths',
      ], ['Calms the nervous system', 'Releases the lower back'], ['Knees together is fine if the hips are tight'], ['Rest on a bolster or a folded blanket']),
    ],
  },
  {
    slug: 'beginner-hatha-basics',
    title: 'Beginner Hatha Foundations',
    description:
      'The foundational postures, held long enough to feel them, with time between to learn what each one is actually asking. The best sequence for someone new to yoga.',
    category: 'beginner',
    difficulty: 'beginner',
    durationMinutes: 25,
    level: 'beginner',
    bestTimeOfDay: 'anytime',
    focusAreas: ['posture', 'flexibility', 'breath'],
    popularity: 95,
    benefits: [
      'Learns the alignment of the core postures',
      'Develops hip and hamstring flexibility',
      'Teaches breath awareness without complexity',
    ],
    precautions: [
      'Never move into a posture you are not breathlessly able to leave',
      'Bend the knees generously; it almost always helps the pose',
    ],
    contraindications: ['A history of spinal injury should consult a teacher before practising backbends'],
    asanas: [
      asana(1, 'Easy Seat', 'Sukhasana', 'A cross legged seat that is an exercise in its own right.', 90, 'none', [
        'Sit with the shins crossed in front of the body',
        'Rest the hands on the knees, palms up',
        'Lift the crown of the head and lengthen the spine',
        'Take ten slow breaths',
      ], ['Teaches upright posture', 'Calms the mind'], ['Sit on a folded blanket if the hips hurt'], ['Sit against a wall for the first few classes']),
      asana(2, 'Cat-Cow', 'Marjaryasana-Bitilasana', 'The spine moving in both directions.', 60, 'none', [
        'Start on all fours with the hands under the shoulders',
        'Inhale, drop the belly and lift the chest and tailbone',
        'Exhale, press the hands away and round the spine',
        'Move slowly with the breath for ten cycles',
      ], ['Mobilises the whole spine', 'Warms the back body'], ['Move one segment at a time, not the whole spine at once'], ['Seated cat-cow with hands on the knees']),
      asana(3, 'Downward Dog', 'Adho Mukha Svanasana', 'The inverted V.', 60, 'none', [
        'Lift the hips up and back from the downward position',
        'Bend the knees to lengthen the spine first',
        'Gradually straighten the legs as the hamstrings allow',
      ], ['Lengthens the calves, hamstrings and back'], ['A bent knee is a better downward dog than a straight leg with a rounded back'], ['Rest the hands on blocks']),
      asana(4, 'Warrior II', 'Virabhadrasana II', 'A grounded standing posture for the legs and hips.', 40, 'both', [
        'Step the feet wide, turn the right foot out 90 degrees',
        'Bend the right knee over the ankle, thigh working towards parallel',
        'Extend the arms in opposite directions, palms down',
        'Gaze over the right fingertips, then repeat on the left',
      ], ['Strengthens the legs', 'Opens the hips and chest'], ['Weight even across both feet, front thigh parallel to the floor at most'], ['Narrow the stance and bend the knee less']),
      asana(5, 'Extended Side Angle', 'Utthita Parsvakonasana', 'A side angle with a strong foundation.', 40, 'both', [
        'From warrior II, rest the forearm on the front thigh',
        'Extend the top arm over the ear toward the front',
        'Rotate the top ribs toward the ceiling',
        'Return to centre and switch sides',
      ], ['Strengthens the legs', 'Stretches the side body and obliques'], ['Stack the top shoulder over the bottom for balance'], ['Use a block under the bottom hand']),
      asana(6, 'Seated Forward Fold', 'Paschimottanasana', 'A seated hamstring fold done safely.', 60, 'none', [
        'Extend the legs in front, feet flexed',
        'Sit on a folded blanket if the lower back rounds',
        'Hinge forward from the hips, leading with the sternum',
        'Rest the hands on the legs wherever they land',
      ], ['Calms the nervous system', 'Lengthens the hamstrings and back'], ['Bend the knees and let the spine stay long'], ['Loop a strap around the feet']),
      asana(7, 'Supine Twist', 'Supta Matsyendrasana', 'A lying rotation for the lower back.', 60, 'both', [
        'Lie on the back, draw the right knee to the chest',
        'Let the knee drop across the body to the left',
        'Keep both shoulders as close to the floor as possible',
        'Breathe, then swap sides',
      ], ['Releases lower back tension', 'Improves spinal rotation'], ['Support the knee on a cushion if it hangs in the air'], ['Both knees to one side for a gentler version']),
      asana(8, 'Legs Up the Wall', 'Viparita Karani', 'A passive inversion that finishes most classes.', 180, 'none', [
        'Lie with the hips near a wall and the legs up the wall',
        'Adjust until the legs are comfortably heavy',
        'Rest the arms out to the sides and close the eyes',
        'Stay for two to five minutes',
      ], ['Reduces leg fatigue', 'Calms the nervous system', 'Supports circulation'], ['A cushion under the hips makes it easier to stay'], ['Bend the knees and rest the calves on a chair']),
    ],
  },
  {
    slug: 'evening-wind-down-yoga',
    title: 'Evening Wind-Down Yoga',
    description:
      'A slow, low sequence for the hour before bed. Nothing here is effortful; the whole point is to slow the breath so the nervous system can downshift.',
    category: 'evening',
    difficulty: 'beginner',
    durationMinutes: 18,
    level: 'beginner',
    bestTimeOfDay: 'evening',
    focusAreas: ['sleep', 'relaxation', 'hips'],
    popularity: 89,
    benefits: [
      'Downshifts before sleep',
      'Releases the hips and lower back after a day of sitting',
      'Slow, long exhales promote relaxation',
    ],
    precautions: [
      'Skip any posture that leaves you feeling more alert, which is normal for some people',
      'Keep the whole sequence gentle; nothing here should feel like a workout',
    ],
    contraindications: ['Skip the plow pose entirely if you have neck or blood pressure concerns'],
    asanas: [
      asana(1, 'Easy Seat with Long Exhale', 'Sukhasana', 'Seated breathing to signal the body down.', 120, 'none', [
        'Sit comfortably with the spine tall',
        'Breathe in for a count of four',
        'Breathe out for a count of six or eight',
        'Repeat for ten rounds',
      ], ['Lengthens the exhale to activate the parasympathetic response'], ['Let the count be approximate rather than exact'], ['Lie on the back instead']),
      asana(2, 'Butterfly Pose', 'Baddha Konasana', 'An inner thigh and groin stretch.', 90, 'none', [
        'Sit with the soles of the feet together',
        'Hold the ankles and let the knees fall open',
        'Sit tall and keep the spine long',
        'Gently hinge forward a few inches',
      ], ['Opens the hips and groin', 'Eases lower back tension'], ['Support the knees with cushions; never force them down'], ['Sit with the knees together for a gentler version']),
      asana(3, 'Supine Bound Angle', 'Supta Baddha Konasana', 'Butterfly with the back supported.', 90, 'none', [
        'Lie on the back and bring the soles of the feet together',
        'Let the knees fall open, supported by cushions if needed',
        'Rest the hands on the belly',
        'Breathe slowly for a few minutes',
      ], ['Opens the hips passively', 'Relaxes the whole body'], [], ['A bolster under the knees for support']),
      asana(4, 'Reclined Twist', 'Supta Matsyendrasana', 'A gentle rotation with the floor fully supporting.', 90, 'both', [
        'Lie on the back, knees bent and feet flat',
        'Lift the knees and let them drop to one side',
        'Extend the bottom leg long and open the opposite arm',
        'Breathe into the twist, then switch',
      ], ['Releases the spine and side body'], ['Support the knees on a cushion'], ['Keep both knees bent and together to one side']),
      asana(5, 'Happy Baby', 'Ananda Balasana', 'A supported hip opener on the back.', 60, 'both', [
        'Lie on the back and draw the knees towards the chest',
        'Hold the outer edges of the feet',
        'Draw the knees down towards the armpits, keeping the lower back down',
        'Rock gently side to side',
      ], ['Opens the hips and lower back', 'Releases the pelvis'], ['Hold behind the thighs instead of the feet'], ['Keep the knees together and hold the shins']),
      asana(6, 'Legs Up the Wall', 'Viparita Karani', 'The final resting position.', 240, 'none', [
        'Scoot the hips close to the wall and extend the legs up it',
        'Adjust the hips until the legs feel heavy and supported',
        'Cover the body with a blanket if it is cool',
        'Stay for four minutes without trying to do anything',
      ], ['Deeply calming', 'Reduces leg heaviness', 'Supports venous return'], ['Bend the knees over a chair if lying flat is uncomfortable'], ['Place a cushion under the hips']),
      asana(7, 'Savasana', 'Savasana', 'Complete stillness, the real end of the practice.', 300, 'none', [
        'Lie flat with the legs slightly apart and the palms up',
        'Let the floor take the full weight of the body',
        'Release deliberate control of the breath',
        'Stay for five minutes or more',
      ], ['Integrates the practice', 'Deep nervous system rest'], ['It is not a failure to sleep here; that is the body doing its job'], ['Sides of the body, or a bolster under the knees']),
    ],
  },
  {
    slug: 'flexibility-hamstring-hip-opener',
    title: 'Flexibility: Hamstrings and Hips',
    description:
      'A focused flexibility session for the two areas that are tight for most desk-bound people. Long passive holds, no bouncing.',
    category: 'flexibility',
    difficulty: 'beginner',
    durationMinutes: 22,
    level: 'beginner',
    bestTimeOfDay: 'anytime',
    focusAreas: ['hamstrings', 'hip flexors', 'adductors'],
    popularity: 84,
    benefits: [
      'Lengthens tight hamstrings and hip flexors',
      'Improves hip range for squats and running',
      'Reduces lower back strain',
    ],
    precautions: [
      'Flexibility work should never be painful; a stretch sensation is fine, sharp pain is not',
      'Breathe into a stretch and never hold the breath',
    ],
    contraindications: ['A recent hamstring or hip injury should be cleared by a professional first'],
    asanas: [
      asana(1, 'Cat-Cow', 'Marjaryasana-Bitilasana', 'Spinal warmup before the holds.', 60, 'none', [
        'Move through ten slow cycles on all fours',
        'Coordinate the breath with each direction',
      ], ['Warms the spine'], [], ['Seated cat-cow']),
      asana(2, 'Low Lunge', 'Anjaneyasana', 'The primary hip flexor stretch.', 75, 'both', [
        'Step the right foot forward from kneeling',
        'Place the hands on the front thigh and lift the chest',
        'Tuck the tailbone under to feel the stretch at the front of the left hip',
        'Breathe, then switch sides',
      ], ['Releases tight hip flexors from sitting'], ['Raise the back knee to reduce the intensity'], ['Place a block under the front thigh for support']),
      asana(3, 'Half Split', 'Ardha Hanumanasana', 'A hamstring stretch for the front leg.', 75, 'both', [
        'Shift the hips back over the back knee',
        'Straighten the front leg and flex the foot',
        'Hinge forward over the front thigh',
        'Keep the hips square and switch sides',
      ], ['Stretches the hamstrings', 'Calms the nervous system'], ['A bent front knee is a valid, safer version'], ['Use a strap around the front foot']),
      asana(4, 'Standing Forward Fold with a Band', 'Uttanasana', 'A supported standing fold.', 60, 'none', [
        'Loop a strap around both feet',
        'Fold forward holding the strap, elbows bending',
        'Keep a generous bend in the knees',
        'Let the head hang heavy',
      ], ['Lengthens the hamstrings and back'], ['If the head pressure is strong, rest it on a bolster'], ['Hands on blocks, or a wall to lean into']),
      asana(5, 'Wide Legged Forward Fold', 'Prasarita Padottanasana', 'A wide stance adductor stretch.', 75, 'none', [
        'Stand wide with the feet turned slightly out',
        'Hinge forward with a long spine',
        'Rest the hands on the floor, blocks or the shins',
        'Keep the knees soft',
      ], ['Stretches the inner thighs and hamstrings'], ['Do not lock the knees straight'], ['Hands on the hips with a flat back, no fold at all']),
      asana(6, 'Half Pigeon', 'Ardha Kapotasana', 'A deep glute and hip stretch.', 90, 'both', [
        'From all fours, bring the right knee forward behind the right wrist',
        'Extend the left leg back',
        'Square the hips and fold forward',
        'Switch sides after holding',
      ], ['Releases gluteal tension', 'Opens the hips'], ['A cushion under the hip makes this far more accessible'], ['Stay upright with hands on the hips, no forward fold']),
      asana(7, 'Seated Head to Knee', 'Janu Sirsasana', 'A calm closing hamstring fold.', 120, 'both', [
        'Sit with the right leg extended and the left foot to the inner thigh',
        'Hinge forward over the extended leg',
        'Breathe into the stretch for two minutes',
        'Switch sides',
      ], ['Deep hamstring and lower back release'], ['Bend the extended knee if the back rounds'], ['Loop a strap around the extended foot']),
      asana(8, 'Supine Hamstring Stretch', 'Supta Padangusthasana', 'A passive, supported hamstring stretch.', 90, 'both', [
        'Lie on the back and loop a strap around one foot',
        'Extend the leg up, keeping the knee straight',
        'Draw the leg towards the chest only to a light stretch',
        'Breathe and switch sides',
      ], ['Stretches the hamstrings without load', 'Releases the lower back'], ['The lower back should stay flat on the floor'], ['Hold behind the thigh with the knee bent']),
    ],
  },
  {
    slug: 'stress-relief-anxiety-relief',
    title: 'Stress Relief: Calming Breath and Stillness',
    description:
      'A short, deliberately low-effort sequence for a high stress day. Most of the time is spent breathing and being still rather than moving, which is the point.',
    category: 'stress_relief',
    difficulty: 'beginner',
    durationMinutes: 15,
    level: 'beginner',
    bestTimeOfDay: 'anytime',
    focusAreas: ['breath', 'relaxation', 'nervous system'],
    popularity: 91,
    benefits: [
      'Long exhales reduce physiological arousal',
      'Gentle movement releases accumulated tension',
      'Leaves you calmer without leaving you tired',
    ],
    precautions: [
      'If a posture brings up strong emotion, switch to a comfortable seated position and breathe',
      'Keep the eyes soft or closed throughout',
    ],
    contraindications: ['Skip inversions if you have glaucoma or uncontrolled blood pressure'],
    asanas: [
      asana(1, 'Seated Breathing', 'Sukhasana Pranayama', 'Extended exhale breathing to start.', 150, 'none', [
        'Sit comfortably tall',
        'Breathe in for four counts',
        'Breathe out for eight counts',
        'Repeat for twelve rounds, longer if it feels good',
      ], ['Activates the parasympathetic nervous system', 'Lowers heart rate', 'Clears mental fog'], ['Skip counting if it makes you anxious; just breathe'], ['Lying down']),
      asana(2, 'Neck Rolls', 'Shirasana', 'Slow, weighted circles to release the neck.', 60, 'none', [
        'Let the head hang forward',
        'Roll it slowly over one shoulder towards the ear',
        'Continue around to the other side',
        'Reverse direction halfway',
      ], ['Releases neck tension'], ['Keep the circles small and the neck loose'], ['Simple nods forward and back']),
      asana(3, 'Cat-Cow with Extended Exhale', 'Marjaryasana-Bitilasana', 'Movement matched to the breath.', 60, 'none', [
        'On all fours, inhale into the cow',
        'Exhale for twice as long into the cat',
        'Continue for ten cycles',
      ], ['Moves the spine while calming the breath'], [], ['Seated with hands on the knees']),
      asana(4, 'Child Pose', 'Balasana', 'The classic rest posture.', 120, 'none', [
        'Kneel and sit the hips back towards the heels',
        'Fold forward with the arms long',
        'Rest the forehead on the mat if it feels good',
        'Breathe slowly for two minutes',
      ], ['Calms the nervous system', 'Releases the lower back'], [], ['Bolster or folded blanket under the torso']),
      asana(5, 'Supported Bridge', 'Setu Bandha Sarvangasana', 'A supported bridge that feels active but effortless.', 90, 'none', [
        'Lie with the knees bent and feet flat',
        'Lift the hips and slide a block or bolster underneath',
        'Rest the arms alongside the body, palms up',
        'Breathe into the belly',
      ], ['Opens the chest', 'Calms the nervous system', 'Gently stimulates the thyroid region traditionally'], ['Skip if you have neck issues'], ['Just rest the knees on each other and lie flat']),
      asana(6, 'Seated Gentle Twist', 'Ardha Matsyendrasana', 'A small rotation to release the mid back.', 60, 'both', [
        'Sit tall with the legs crossed',
        'Place the right hand on the left knee',
        'Rotate gently to the right, following with the eyes',
        'Hold and breathe, then switch',
      ], ['Releases mid back tension'], ['The rotation should be small; this is not a deep twist'], ['Hands on the knees, no rotation at all']),
      asana(7, 'Supine Breathing', 'Shavasana', 'Final rest on the back.', 240, 'none', [
        'Lie flat with the arms slightly away from the body',
        'Let the belly rise and fall with each breath',
        'Release the effort of holding the breath',
        'Stay for four minutes',
      ], ['Deep rest', 'Integrates the practice'], ['It is fine to fall asleep'], ['Knees bent with feet flat, or a cushion under the knees']),
    ],
  },
  {
    slug: 'back-friendly-gentle-mobility',
    title: 'Back-Friendly Gentle Mobility',
    description:
      'Designed for anyone with a history of back pain or a disc concern. Every movement keeps the spine in a neutral or gently rounded position; there is no loaded flexion or extension.',
    category: 'back_friendly',
    difficulty: 'beginner',
    durationMinutes: 16,
    level: 'beginner',
    bestTimeOfDay: 'anytime',
    focusAreas: ['spinal mobility', 'hip mobility', 'core stability'],
    popularity: 78,
    benefits: [
      'Improves spinal mobility without loading the discs',
      'Strengthens the stabilising muscles around the spine',
      'Suitable for disc recovery with professional guidance',
    ],
    precautions: [
      'No deep backbends and no strong spinal flexion in this sequence',
      'Stop with any sharp or shooting pain; a gentle ache is acceptable',
    ],
    contraindications: [
      'This is a general wellbeing routine, not a treatment plan; an active disc problem needs a physiotherapist',
    ],
    asanas: [
      asana(1, 'Supine Breathing', 'Shavasana', 'A neutral spine start.', 90, 'none', [
        'Lie on the back with the knees bent and feet flat',
        'Let the lower back stay neutral against the floor',
        'Breathe into the belly for a minute',
      ], ['Establishes neutral spine', 'Calms the system'], [], ['Knees together and hugging them in, if more rest is needed']),
      asana(2, 'Knee to Chest', 'Apanasana', 'A gentle single hip stretch.', 60, 'both', [
        'Draw one knee to the chest with both hands',
        'Keep the opposite leg long on the floor',
        'Hold and breathe, then switch',
      ], ['Releases the lower back', 'Stretches the glutes'], ['Keep the head resting on the floor; do not lift the head'], ['Both knees to the chest, rocking gently']),
      asana(3, 'Cat-Cow', 'Marjaryasana-Bitilasana', 'The only spinal flexion and extension in the session, kept small.', 60, 'none', [
        'On all fours, move through small cat-cow cycles',
        'Keep the movement within a comfortable range',
        'Ten slow cycles',
      ], ['Gently mobilises the spine'], ['Make the movements smaller if the back is sensitive'], ['Rocking gently between the hands and knees with a flat back']),
      asana(4, 'Bird Dog', 'Parsva Baddha Pada Urdhva Mukha Svanasana', 'Core stability without spinal movement.', 60, 'both', [
        'On all fours, extend the opposite arm and leg',
        'Keep the spine level, hips square to the floor',
        'Hold for 5 seconds, repeat, then switch sides',
      ], ['Strengthens the spinal stabilisers', 'Improves trunk control'], ['Only lift as high as the spine stays level'], ['Extend just the leg, then just the arm']),
      asana(5, 'Glute Bridge', 'Setu Bandha Sarvangasana', 'A posterior chain activation in neutral spine.', 60, 'none', [
        'Feet flat, knees hip width apart',
        'Press through the heels and lift the hips',
        'Keep the ribs down so the lower back does not arch',
        'Pause at the top for 3 seconds',
      ], ['Strengthens the glutes and hamstrings', 'Supports the lumbar spine'], ['Do not lift higher than a straight line from knee to shoulder'], ['Lift one foot and hold briefly for extra work']),
      asana(6, 'Supine Spinal Twist', 'Supta Matsyendrasana', 'A gentle rotation with no compression.', 75, 'both', [
        'Lie with the knees bent and drop them to one side',
        'Keep both shoulders relaxed on the floor',
        'Breathe and switch',
      ], ['Gently rotates the spine', 'Releases side body tension'], ['The legs can stay bent and together to reduce rotation'], ['Knees dropped together to one side']),
      asana(7, 'Sphinx Pose', 'Salamba Bhujangasana', 'Gentle extension that loads the lower back very little.', 60, 'none', [
        'Lie face down and prop up on the forearms',
        'Elbows under the shoulders, keeping the legs long',
        'Lengthen the tailbone towards the heels',
        'Relax the neck and jaw',
      ], ['Gently extends the lower back', 'Opens the chest'], ['Do not lift higher with the arms; the movement should come from the spine relaxing'], ['Rest face down with the head turned to one side']),
      asana(8, 'Rest', 'Shavasana', 'Complete rest.', 180, 'none', [
        'Lie flat with the legs long and the arms out to the sides',
        'Let the floor support everything',
        'Stay for three minutes',
      ], ['Integrates the session', 'Full relaxation'], [], ['Knees bent with feet flat']),
    ],
  },
  {
    slug: 'relaxation-yoga-nidra-style',
    title: 'Deep Relaxation Yoga',
    description:
      'A very simple sequence of supported shapes with a long guided body scan at the end. The most restorative routine in the set, and the easiest to fall asleep to.',
    category: 'relaxation',
    difficulty: 'beginner',
    durationMinutes: 20,
    level: 'beginner',
    bestTimeOfDay: 'evening',
    focusAreas: ['deep rest', 'sleep', 'stress'],
    popularity: 86,
    benefits: ['Deep nervous system rest', 'Reduces rumination before bed', 'Gently releases the whole body'],
    precautions: ['Keep the breathing soft and unforced throughout', 'If you fall asleep, that is a success, not a failure'],
    contraindications: ['Any shape that compresses the back should be adjusted with cushions'],
    asanas: [
      asana(1, 'Constructive Rest', 'Savasana', 'The most important posture in the practice.', 180, 'none', [
        'Lie on the back with the legs long and slightly apart',
        'Palms up, arms about 45 degrees from the body',
        'Let each exhale be slightly longer than the inhale',
      ], ['Complete physical rest', 'Teaches the body to let go'], [], ['Bolster under the knees and a blanket over the body']),
      asana(2, 'Constructive Rest, Knees Bent', 'Supta Baddha Konasana', 'Supported rest for a sensitive lower back.', 120, 'none', [
        'Soles of the feet together, knees apart, cushions under the knees',
        'Rest the hands on the belly',
        'Breathe slowly',
      ], ['Fully supported relaxation'], [], ['Legs up a chair or a wall']),
      asana(3, 'Supported Fish Pose', 'Matsyasana', 'An open chest on bolsters.', 120, 'none', [
        'Lie lengthwise over two bolsters stacked under the upper back',
        'Let the head fall back over a folded blanket',
        'Rest the arms out to the sides',
      ], ['Opens the chest and front shoulders', 'Encourages deep breathing'], ['Stop if there is any neck discomfort'], ['A simple supine position with the arms wide']),
      asana(4, 'Supported Reclined Bound Angle', 'Supta Baddha Konasana', 'A fully supported hip opener.', 120, 'none', [
        'Place a bolster lengthwise along the spine',
        'Soles of the feet together, knees apart and supported',
        'Rest the hands on the belly and breathe',
      ], ['Passive hip opening', 'Deep relaxation'], ['The bolster does all the work; nothing needs to be felt'], ['Knees bent and feet flat on a cushion']),
      asana(5, 'Supported Bridge', 'Setu Bandha Sarvangasana', 'A supported inversion of the pelvis.', 120, 'none', [
        'Feet flat, knees hip width apart, hips lifted',
        'Slide a bolster or block under the sacrum',
        'Rest the arms alongside the body',
      ], ['Calming and grounding', 'Lengthens the front body'], ['Remove the support before the sacrum feels strained'], ['Lift the hips without any support, briefly']),
      asana(6, 'Legs Up the Wall', 'Viparita Karani', 'The classic final rest.', 300, 'none', [
        'Scoot the hips to the wall and extend the legs up',
        'Adjust until the legs are heavy',
        'Stay for five minutes without effort',
      ], ['Deeply restful', 'Reduces leg heaviness', 'Supports circulation'], ['A chair works if lying flat is not comfortable'], ['Bolster under the hips, legs up a wall']),
      asana(7, 'Body Scan', 'Shavasana', 'A slow, guided attention sweep from feet to head.', 600, 'none', [
        'Lie completely still',
        'Bring attention to the feet, then the legs, hips, belly, chest',
        'Continue up the arms, shoulders, throat, forehead',
        'Notice without changing anything',
      ], ['Deep relaxation', 'Builds body awareness', 'Settles racing thoughts'], ['If attention wanders, that is normal; just return to the feet'], ['Shorter scan of 5 minutes, or a guided version from an app']),
    ],
  },
];
