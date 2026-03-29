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

fixFile('./screens/ProgressDashboardScreen.tsx', [
    ['totalClasses', 'totalClassesAttended'],
    ['total_classes', 'totalClassesAttended']
]);

fixFile('./components/dashboard/SnapshotsView.tsx', [
    ['current_streak', 'currentStreak'],
    ['longest_streak', 'longestStreak']
]);
