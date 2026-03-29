export type UserGoal = 'lose_weight' | 'build_muscle' | 'recomp' | 'maintenance';

export interface FoodItem {
    id: string;
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    tags: string[];
    emoji: string;
    goalSuitability: UserGoal[];
    isZambian?: boolean;
    preparationTime?: string;
}

interface SeedMeal {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    tags: string[];
    emoji: string;
    goalSuitability: UserGoal[];
    isZambian?: boolean;
}

const STYLE_VARIANTS = [
    { id: 'classic', label: 'Classic', kcal: 0, protein: 0, carbs: 0, fats: 0, tags: ['balanced'] },
    { id: 'lean', label: 'Lean', kcal: -35, protein: 4, carbs: -6, fats: -2, tags: ['lean', 'high-protein'] },
    { id: 'power', label: 'Power', kcal: 40, protein: 6, carbs: 5, fats: 1, tags: ['performance', 'post-workout'] },
    { id: 'local', label: 'Local Heritage', kcal: 10, protein: 1, carbs: 2, fats: 0, tags: ['local', 'traditional'] },
    { id: 'chef', label: 'Chef Signature', kcal: 20, protein: 2, carbs: 1, fats: 1, tags: ['fancy', 'premium'] },
] as const;

const clamp = (value: number, min: number) => Math.max(min, Math.round(value));

const buildMeals = (
    prefix: string,
    mealType: FoodItem['mealType'],
    seeds: SeedMeal[]
): FoodItem[] => {
    const meals: FoodItem[] = [];

    seeds.forEach((seed, seedIndex) => {
        STYLE_VARIANTS.forEach((variant) => {
            meals.push({
                id: `${prefix}_${seedIndex + 1}_${variant.id}`,
                name: `${variant.label} ${seed.name}`,
                description: `${seed.description}. ${variant.label} healthy preparation.`,
                calories: clamp(seed.calories + variant.kcal, 90),
                protein: clamp(seed.protein + variant.protein, 4),
                carbs: clamp(seed.carbs + variant.carbs, 4),
                fats: clamp(seed.fats + variant.fats, 2),
                mealType,
                tags: [...new Set([...seed.tags, ...variant.tags])],
                emoji: seed.emoji,
                goalSuitability: seed.goalSuitability,
                isZambian: seed.isZambian || variant.id === 'local',
            });
        });
    });

    return meals;
};

const BREAKFAST_SEEDS: SeedMeal[] = [
    { name: 'Millet Porridge Bowl', description: 'Millet porridge with chia and banana', calories: 320, protein: 14, carbs: 48, fats: 8, tags: ['fiber'], emoji: '🥣', goalSuitability: ['lose_weight', 'recomp', 'maintenance'], isZambian: true },
    { name: 'Soya Nshima Breakfast Bowl', description: 'Light soya-infused nshima with egg whites and greens', calories: 360, protein: 26, carbs: 42, fats: 10, tags: ['high-protein'], emoji: '🌽', goalSuitability: ['build_muscle', 'recomp'], isZambian: true },
    { name: 'Sweet Potato & Egg Plate', description: 'Boiled kandolo with eggs and tomato salsa', calories: 340, protein: 22, carbs: 40, fats: 10, tags: ['whole-food'], emoji: '🍠', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Greek Yogurt Fruit Crunch', description: 'Greek yogurt with pawpaw and roasted seeds', calories: 300, protein: 24, carbs: 26, fats: 10, tags: ['quick'], emoji: '🥣', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Bean & Veg Omelette', description: 'Three-egg omelette with beans and spinach', calories: 370, protein: 30, carbs: 18, fats: 16, tags: ['high-protein'], emoji: '🍳', goalSuitability: ['build_muscle', 'lose_weight'], isZambian: true },
    { name: 'Oats Protein Pot', description: 'Rolled oats cooked with milk and peanut dust', calories: 350, protein: 20, carbs: 45, fats: 10, tags: ['post-workout'], emoji: '🥣', goalSuitability: ['build_muscle', 'maintenance'], isZambian: true },
    { name: 'Avocado Toast Zambia Style', description: 'Wholegrain toast with avocado and tomato', calories: 330, protein: 12, carbs: 32, fats: 15, tags: ['healthy-fats'], emoji: '🥑', goalSuitability: ['maintenance', 'recomp'], isZambian: true },
    { name: 'Chikanda Breakfast Bites', description: 'Baked chikanda slices with cucumber salad', calories: 290, protein: 16, carbs: 24, fats: 12, tags: ['traditional'], emoji: '🥔', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Kapenta Scramble', description: 'Egg scramble with kapenta and onions', calories: 310, protein: 32, carbs: 8, fats: 16, tags: ['omega-3'], emoji: '🐟', goalSuitability: ['build_muscle', 'lose_weight'], isZambian: true },
    { name: 'Protein Pancake Stack', description: 'Banana oat protein pancakes with berries', calories: 360, protein: 28, carbs: 38, fats: 10, tags: ['fancy'], emoji: '🥞', goalSuitability: ['build_muscle', 'maintenance'], isZambian: false },
    { name: 'Mabisi Chia Cup', description: 'Mabisi with chia seeds and guava', calories: 280, protein: 18, carbs: 24, fats: 10, tags: ['probiotic'], emoji: '🥛', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Smoked Chicken Breakfast Wrap', description: 'Whole-wheat wrap with smoked chicken strips', calories: 370, protein: 32, carbs: 30, fats: 12, tags: ['portable'], emoji: '🌯', goalSuitability: ['build_muscle', 'maintenance'], isZambian: false },
    { name: 'Pumpkin Seed Muesli', description: 'Unsweetened muesli with pumpkin seeds and milk', calories: 340, protein: 18, carbs: 40, fats: 12, tags: ['fiber'], emoji: '🥣', goalSuitability: ['maintenance', 'recomp'], isZambian: true },
    { name: 'Tofu Veg Scramble', description: 'Tofu scramble with peppers and onions', calories: 300, protein: 24, carbs: 14, fats: 14, tags: ['plant-protein'], emoji: '🍳', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Cottage Cheese Bowl', description: 'Cottage cheese with pineapple and flaxseed', calories: 290, protein: 28, carbs: 20, fats: 10, tags: ['high-protein'], emoji: '🧀', goalSuitability: ['lose_weight', 'build_muscle'], isZambian: false },
    { name: 'Samp Bean Sunrise Bowl', description: 'Samp and beans with leafy greens', calories: 360, protein: 20, carbs: 50, fats: 8, tags: ['traditional'], emoji: '🫘', goalSuitability: ['maintenance', 'recomp'], isZambian: true },
    { name: 'Bream & Spinach Toast', description: 'Flaked grilled bream on wholegrain toast', calories: 320, protein: 30, carbs: 24, fats: 10, tags: ['omega-3'], emoji: '🐠', goalSuitability: ['build_muscle', 'lose_weight'], isZambian: true },
    { name: 'Quinoa Fruit Breakfast', description: 'Quinoa porridge with mango and cinnamon', calories: 330, protein: 16, carbs: 46, fats: 8, tags: ['whole-grain'], emoji: '🥣', goalSuitability: ['recomp', 'maintenance'], isZambian: false },
    { name: 'Turkey Sausage Protein Plate', description: 'Turkey sausage with eggs and avocado', calories: 390, protein: 34, carbs: 14, fats: 20, tags: ['high-protein'], emoji: '🍳', goalSuitability: ['build_muscle', 'maintenance'], isZambian: false },
    { name: 'Groundnut Butter Oat Toast', description: 'Wholegrain toast with natural groundnut butter', calories: 350, protein: 16, carbs: 34, fats: 16, tags: ['energy'], emoji: '🍞', goalSuitability: ['build_muscle', 'maintenance'], isZambian: true },
];

const LUNCH_SEEDS: SeedMeal[] = [
    { name: 'Nshima Chicken Greens Plate', description: 'Portion-controlled nshima with grilled chicken and rape', calories: 520, protein: 42, carbs: 52, fats: 14, tags: ['traditional'], emoji: '🍗', goalSuitability: ['build_muscle', 'recomp'], isZambian: true },
    { name: 'Kapenta Bean Power Bowl', description: 'Kapenta, beans, and vegetables bowl', calories: 500, protein: 38, carbs: 48, fats: 14, tags: ['omega-3'], emoji: '🐟', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Ifisashi Lean Plate', description: 'Ifisashi with extra greens and lean fish', calories: 510, protein: 34, carbs: 45, fats: 18, tags: ['traditional'], emoji: '🥗', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Goat Veg Stew Bowl', description: 'Lean goat stew with vegetables and millet', calories: 540, protein: 40, carbs: 44, fats: 16, tags: ['local'], emoji: '🍲', goalSuitability: ['build_muscle', 'maintenance'], isZambian: true },
    { name: 'Bream Brown Rice Plate', description: 'Grilled bream with brown rice and salad', calories: 490, protein: 36, carbs: 46, fats: 12, tags: ['clean'], emoji: '🐟', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Chicken Quinoa Salad', description: 'Chicken breast quinoa salad with citrus dressing', calories: 470, protein: 40, carbs: 36, fats: 14, tags: ['fancy'], emoji: '🥗', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Turkey Wrap Protein Lunch', description: 'Whole-wheat turkey wrap with hummus', calories: 460, protein: 34, carbs: 40, fats: 12, tags: ['portable'], emoji: '🌯', goalSuitability: ['recomp', 'maintenance'], isZambian: false },
    { name: 'Beef Pumpkin Leaf Bowl', description: 'Lean beef with pumpkin leaves and sweet potato', calories: 530, protein: 38, carbs: 44, fats: 16, tags: ['traditional'], emoji: '🥩', goalSuitability: ['build_muscle', 'maintenance'], isZambian: true },
    { name: 'Soya Veg Stir Fry', description: 'Soya chunks stir-fried with mixed vegetables', calories: 450, protein: 34, carbs: 42, fats: 10, tags: ['plant-protein'], emoji: '🥦', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Tilapia Couscous Plate', description: 'Herb tilapia with couscous and salad', calories: 500, protein: 38, carbs: 46, fats: 12, tags: ['fancy'], emoji: '🐟', goalSuitability: ['maintenance', 'recomp'], isZambian: false },
    { name: 'Lentil Chicken Bowl', description: 'Lentils, chicken strips, and spinach', calories: 480, protein: 40, carbs: 38, fats: 12, tags: ['high-fiber'], emoji: '🍲', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Impwa Turkey Stew Plate', description: 'Impwa stew with turkey and maize meal', calories: 520, protein: 36, carbs: 48, fats: 14, tags: ['local'], emoji: '🍆', goalSuitability: ['build_muscle', 'maintenance'], isZambian: true },
    { name: 'Egg Fried Rice Lite', description: 'Brown rice with eggs and vegetables', calories: 470, protein: 28, carbs: 52, fats: 10, tags: ['quick'], emoji: '🍚', goalSuitability: ['maintenance', 'recomp'], isZambian: false },
    { name: 'Chickpea Avocado Bowl', description: 'Chickpea avocado bowl with tomato and herbs', calories: 460, protein: 22, carbs: 44, fats: 16, tags: ['plant-protein'], emoji: '🥑', goalSuitability: ['lose_weight', 'maintenance'], isZambian: false },
    { name: 'Nshima Beef Veg Plate', description: 'Moderate nshima with lean beef and cabbage', calories: 530, protein: 40, carbs: 50, fats: 14, tags: ['traditional'], emoji: '🍲', goalSuitability: ['build_muscle', 'recomp'], isZambian: true },
    { name: 'Tuna Bean Salad Lunch', description: 'Tuna and bean salad with cucumber and onions', calories: 440, protein: 36, carbs: 30, fats: 14, tags: ['omega-3'], emoji: '🥗', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Chicken Millet Pilaf', description: 'Chicken breast with millet pilaf and greens', calories: 510, protein: 38, carbs: 46, fats: 14, tags: ['whole-grain'], emoji: '🍛', goalSuitability: ['build_muscle', 'maintenance'], isZambian: false },
    { name: 'Baked Goat Salad Plate', description: 'Baked goat strips with mixed leafy salad', calories: 500, protein: 42, carbs: 24, fats: 20, tags: ['local'], emoji: '🥗', goalSuitability: ['build_muscle', 'lose_weight'], isZambian: true },
    { name: 'Mabisi Chicken Slaw Bowl', description: 'Chicken slaw bowl with mabisi yogurt dressing', calories: 470, protein: 36, carbs: 34, fats: 14, tags: ['probiotic'], emoji: '🥗', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Salmon Veg Pasta Plate', description: 'Whole-wheat pasta with salmon and greens', calories: 520, protein: 36, carbs: 48, fats: 14, tags: ['fancy'], emoji: '🍝', goalSuitability: ['build_muscle', 'maintenance'], isZambian: false },
];

const DINNER_SEEDS: SeedMeal[] = [
    { name: 'Grilled Bream Dinner', description: 'Grilled bream with steamed vegetables and millet', calories: 500, protein: 40, carbs: 36, fats: 14, tags: ['local'], emoji: '🐠', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Chicken Ifisashi Plate', description: 'Ifisashi with grilled chicken strips', calories: 520, protein: 38, carbs: 40, fats: 16, tags: ['traditional'], emoji: '🥬', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Lean Beef Nshima Plate', description: 'Lean beef stew with controlled nshima portion', calories: 540, protein: 42, carbs: 44, fats: 16, tags: ['traditional'], emoji: '🥘', goalSuitability: ['build_muscle', 'maintenance'], isZambian: true },
    { name: 'Turkey Veg Stir Fry', description: 'Turkey strips with broccoli and peppers', calories: 470, protein: 40, carbs: 24, fats: 14, tags: ['low-carb'], emoji: '🍲', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Kapenta Pumpkin Leaf Bowl', description: 'Kapenta with pumpkin leaves and beans', calories: 500, protein: 38, carbs: 34, fats: 16, tags: ['traditional'], emoji: '🥬', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Salmon Asparagus Plate', description: 'Oven salmon with asparagus and sweet potato mash', calories: 530, protein: 38, carbs: 32, fats: 20, tags: ['fancy'], emoji: '🐟', goalSuitability: ['maintenance', 'build_muscle'], isZambian: false },
    { name: 'Goat Stew Veg Dinner', description: 'Lean goat stew with mixed vegetables', calories: 520, protein: 40, carbs: 30, fats: 18, tags: ['local'], emoji: '🐐', goalSuitability: ['build_muscle', 'recomp'], isZambian: true },
    { name: 'Tofu Lentil Bowl', description: 'Tofu, lentils, and spinach in tomato sauce', calories: 460, protein: 30, carbs: 42, fats: 10, tags: ['plant-protein'], emoji: '🥗', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Chicken Brown Rice Dinner', description: 'Grilled chicken with brown rice and cabbage', calories: 510, protein: 40, carbs: 44, fats: 12, tags: ['balanced'], emoji: '🍛', goalSuitability: ['maintenance', 'build_muscle'], isZambian: false },
    { name: 'Bream Okra Plate', description: 'Bream fillet with delele and millet', calories: 490, protein: 36, carbs: 38, fats: 14, tags: ['traditional'], emoji: '🍲', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Impwa Chicken Pot', description: 'Impwa pot with skinless chicken', calories: 500, protein: 38, carbs: 36, fats: 14, tags: ['local'], emoji: '🍆', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Prawn Quinoa Dinner', description: 'Garlic prawns with quinoa and spinach', calories: 500, protein: 36, carbs: 40, fats: 12, tags: ['fancy'], emoji: '🍤', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Chicken Bean Chili Bowl', description: 'Chicken and bean chili with herbs', calories: 490, protein: 38, carbs: 38, fats: 12, tags: ['high-fiber'], emoji: '🍲', goalSuitability: ['build_muscle', 'recomp'], isZambian: false },
    { name: 'Mabisi Marinated Fish', description: 'Mabisi-marinated fish with grilled vegetables', calories: 480, protein: 36, carbs: 28, fats: 16, tags: ['probiotic'], emoji: '🐟', goalSuitability: ['lose_weight', 'maintenance'], isZambian: true },
    { name: 'Lean Beef Zoodle Bowl', description: 'Lean beef strips with zucchini noodles', calories: 450, protein: 38, carbs: 18, fats: 16, tags: ['low-carb'], emoji: '🥩', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Soya Mushroom Dinner', description: 'Soya chunks and mushrooms with herbs', calories: 460, protein: 32, carbs: 34, fats: 12, tags: ['plant-protein'], emoji: '🍄', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Turkey Sweet Potato Plate', description: 'Turkey breast with sweet potato and greens', calories: 510, protein: 42, carbs: 38, fats: 12, tags: ['performance'], emoji: '🍠', goalSuitability: ['build_muscle', 'maintenance'], isZambian: false },
    { name: 'Eggplant Lentil Stew', description: 'Eggplant lentil stew with herbs', calories: 440, protein: 24, carbs: 44, fats: 10, tags: ['plant-protein'], emoji: '🍆', goalSuitability: ['lose_weight', 'recomp'], isZambian: false },
    { name: 'Chicken Millet Tagine', description: 'Spiced chicken millet tagine with vegetables', calories: 520, protein: 38, carbs: 42, fats: 14, tags: ['fancy'], emoji: '🍲', goalSuitability: ['maintenance', 'build_muscle'], isZambian: false },
    { name: 'Kapenta Garden Bowl', description: 'Kapenta with garden vegetables and beans', calories: 500, protein: 36, carbs: 34, fats: 16, tags: ['traditional'], emoji: '🥬', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
];

const SNACK_SEEDS: SeedMeal[] = [
    { name: 'Greek Yogurt Berry Cup', description: 'Greek yogurt with berry mix', calories: 190, protein: 16, carbs: 16, fats: 6, tags: ['high-protein'], emoji: '🫐', goalSuitability: ['lose_weight', 'recomp'] },
    { name: 'Groundnut Banana Bites', description: 'Banana with natural groundnut butter', calories: 220, protein: 8, carbs: 24, fats: 10, tags: ['energy'], emoji: '🍌', goalSuitability: ['maintenance', 'build_muscle'], isZambian: true },
    { name: 'Kapenta Crisp Bowl', description: 'Roasted kapenta with cucumber slices', calories: 180, protein: 20, carbs: 6, fats: 8, tags: ['omega-3'], emoji: '🐟', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Mabisi Chia Snack', description: 'Mabisi with chia and cinnamon', calories: 190, protein: 12, carbs: 14, fats: 9, tags: ['probiotic'], emoji: '🥛', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Egg & Avocado Duo', description: 'One egg with avocado slices', calories: 210, protein: 11, carbs: 8, fats: 16, tags: ['healthy-fats'], emoji: '🥚', goalSuitability: ['lose_weight', 'maintenance'] },
    { name: 'Cottage Cheese Pineapple Cup', description: 'Cottage cheese with pineapple chunks', calories: 180, protein: 18, carbs: 12, fats: 5, tags: ['high-protein'], emoji: '🧀', goalSuitability: ['lose_weight', 'build_muscle'] },
    { name: 'Apple Cinnamon Oat Bites', description: 'Baked oat and apple mini bites', calories: 200, protein: 8, carbs: 24, fats: 8, tags: ['fiber'], emoji: '🍎', goalSuitability: ['recomp', 'maintenance'] },
    { name: 'Roasted Chickpea Crunch', description: 'Roasted chickpeas with paprika', calories: 190, protein: 10, carbs: 22, fats: 6, tags: ['plant-protein'], emoji: '🫘', goalSuitability: ['lose_weight', 'recomp'] },
    { name: 'Protein Shake Lite', description: 'Whey shake with water and ice', calories: 150, protein: 24, carbs: 5, fats: 2, tags: ['post-workout'], emoji: '🥤', goalSuitability: ['build_muscle', 'lose_weight'] },
    { name: 'Maputi Protein Mix', description: 'Light maputi with roasted soy nuts', calories: 200, protein: 11, carbs: 24, fats: 6, tags: ['local'], emoji: '🍿', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Vitumbuwa Protein Fritters', description: 'Baked ifitumbuwa-style fritters with oat and yogurt dip', calories: 210, protein: 12, carbs: 24, fats: 8, tags: ['traditional', 'healthy-swap'], emoji: '🧆', goalSuitability: ['recomp', 'maintenance'], isZambian: true },
    { name: 'Soya Yogurt Fruit Pot', description: 'Soya yogurt with diced fruit', calories: 180, protein: 12, carbs: 18, fats: 6, tags: ['plant-protein'], emoji: '🥣', goalSuitability: ['lose_weight', 'recomp'], isZambian: true },
    { name: 'Carrot Hummus Snack', description: 'Carrot sticks and hummus', calories: 180, protein: 7, carbs: 18, fats: 9, tags: ['veggie'], emoji: '🥕', goalSuitability: ['lose_weight', 'maintenance'] },
    { name: 'Biltong Nut Combo', description: 'Biltong strips with almonds', calories: 210, protein: 20, carbs: 6, fats: 12, tags: ['high-protein'], emoji: '🥩', goalSuitability: ['build_muscle', 'recomp'] },
    { name: 'Pear Seed Crunch', description: 'Pear with sunflower seeds', calories: 190, protein: 6, carbs: 24, fats: 8, tags: ['fiber'], emoji: '🍐', goalSuitability: ['maintenance', 'recomp'] },
    { name: 'Boiled Groundnut Cup', description: 'Boiled groundnuts with herbs', calories: 200, protein: 10, carbs: 10, fats: 14, tags: ['traditional'], emoji: '🥜', goalSuitability: ['maintenance', 'build_muscle'], isZambian: true },
    { name: 'Smoked Chicken Mini Bowl', description: 'Smoked chicken bites with peppers', calories: 190, protein: 20, carbs: 8, fats: 8, tags: ['high-protein'], emoji: '🍗', goalSuitability: ['build_muscle', 'lose_weight'] },
    { name: 'Orange Yogurt Pair', description: 'Orange wedges with plain yogurt', calories: 170, protein: 10, carbs: 20, fats: 5, tags: ['light'], emoji: '🍊', goalSuitability: ['lose_weight', 'recomp'] },
    { name: 'Tofu Spice Cubes', description: 'Baked tofu cubes with spice rub', calories: 180, protein: 16, carbs: 8, fats: 8, tags: ['plant-protein'], emoji: '🍱', goalSuitability: ['recomp', 'maintenance'] },
    { name: 'Chef Fruit Protein Verrine', description: 'Layered fruit and protein yogurt cup', calories: 200, protein: 15, carbs: 20, fats: 6, tags: ['fancy', 'premium'], emoji: '🍓', goalSuitability: ['recomp', 'maintenance'] },
];

const BREAKFAST_MEALS = buildMeals('b', 'breakfast', BREAKFAST_SEEDS);
const LUNCH_MEALS = buildMeals('l', 'lunch', LUNCH_SEEDS);
const DINNER_MEALS = buildMeals('d', 'dinner', DINNER_SEEDS);
const SNACK_MEALS = buildMeals('s', 'snack', SNACK_SEEDS);

export const FOOD_DATABASE: FoodItem[] = [
    ...BREAKFAST_MEALS,
    ...LUNCH_MEALS,
    ...DINNER_MEALS,
    ...SNACK_MEALS,
];

if (
    BREAKFAST_MEALS.length !== 100 ||
    LUNCH_MEALS.length !== 100 ||
    DINNER_MEALS.length !== 100 ||
    SNACK_MEALS.length !== 100
) {
    throw new Error('Food dataset must contain exactly 100 meals for breakfast, lunch, dinner, and snack.');
}
