const fs = require('fs');

const fixFile = (file, replaces) => {
    let content = fs.readFileSync(file, 'utf8');
    for (const [search, replace] of replaces) {
        content = content.split(search).join(replace);
    }
    fs.writeFileSync(file, content);
};

fixFile('./screens/RoomDashboardScreen.tsx', [
    ['typedRoom.duration_days', 'typedRoom.durationDays'],
    ['typedRoom.max_members', 'typedRoom.maxMembers'],
    ['room?.duration_days', 'room?.durationDays'],
    ['room?.start_date', 'room?.startDate'],
    ['room?.created_at', 'room?.createdAt'],
    ['room?.member_count', 'room?.memberCount'],
    ['room?.max_members', 'room?.maxMembers'],
    ['room.start_date', 'room.startDate'],
    ['room.created_at', 'room.createdAt']
]);

fixFile('./screens/RoomsScreen.tsx', [
    ['item.community_vibe', 'item.communityVibe'],
    ['item.is_women_only', 'item.isWomenOnly'],
    ['item.experience_level', 'item.experienceLevel'],
    ['item.max_members', 'item.maxMembers'],
    ['item.active_level', 'item.activeLevel'],
    ['r.is_women_only', 'r.isWomenOnly']
]);

console.log('Fixed properties!');
