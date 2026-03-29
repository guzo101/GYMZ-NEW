const fs = require('fs');

const fixFile = (file, replaces) => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        for (const [search, replace] of replaces) {
            content = content.split(search).join(replace);
        }
        fs.writeFileSync(file, content);
        console.log(`Fixed ${file}`);
    } catch (e) {
        console.log(`Skipped ${file}: ${e.message}`);
    }
};

fixFile('./services/progressReportService.ts', [
    ['activeGoal?.daily_protein_goal', 'activeGoal?.dailyProteinGoal']
]);

fixFile('./screens/ProgressDashboardScreen.tsx', [
    ['total_classes', 'totalClasses'],
    ['total_checkins', 'totalCheckins'],
    ['total_duration', 'totalDuration'],
    ['total_volume', 'totalVolume'],
    ['goal.daily_calorie_goal', 'goal.dailyCalorieGoal'],
    ['goal?.daily_calorie_goal', 'goal?.dailyCalorieGoal'],
    ['goal?.target_weight', 'goal?.targetWeight'],
    ['item.total_calories', 'item.totalCalories'],
    ['item.total_protein', 'item.totalProtein'],
    ['item.total_carbs', 'item.totalCarbs'],
    ['item.total_fats', 'item.totalFats']
]);

fixFile('./components/dashboard/SnapshotsView.tsx', [
    ['activeGoal.daily_calorie_goal', 'activeGoal.dailyCalorieGoal'],
    ['activeGoal?.daily_calorie_goal', 'activeGoal?.dailyCalorieGoal'],
    ['activeGoal?.daily_protein_goal', 'activeGoal?.dailyProteinGoal'],
    ['activeGoal?.daily_carbs_goal', 'activeGoal?.dailyCarbsGoal'],
    ['activeGoal?.daily_fats_goal', 'activeGoal?.dailyFatsGoal']
]);
