import { supabase } from './supabase';
import { startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { DataMapper } from '../utils/dataMapper';

export interface Tribe {
    id: string;
    name: string;
    category: string;
    description: string;
    goal: string;
    rules: string;
    adminId: string;
    createdAt: string;
    active: boolean;
    memberCount?: number;
    startDate?: string;
    durationDays?: number;
    maxMembers?: number;
    experienceLevel?: string;
    communityVibe?: string;
    isWomenOnly?: boolean;
    activeLevel?: string;
    gymId?: string;
}

export interface TribePost {
    id: string;
    tribeId: string;
    userId: string;
    content: string;
    imageUrl?: string;
    type: 'text' | 'image' | 'progress';
    progressData?: any;
    createdAt: string;
    userName?: string;
    userAvatar?: string;
    reactions?: any[];
    commentsCount?: number;
}

// ── SANITIZATION LAYER (Absolute Harmony Standard) ─────────────────────────
export const mapTribe = (data: any): Tribe => ({
    id: data.id,
    name: data.name,
    category: data.category,
    description: data.description,
    goal: data.goal,
    rules: data.rules,
    adminId: data.admin_id,
    createdAt: data.created_at,
    active: data.active,
    memberCount: parseInt(data.room_members?.[0]?.count || data.member_count || '0'),
    startDate: data.start_date,
    durationDays: data.duration_days,
    maxMembers: data.max_members,
    experienceLevel: data.experience_level,
    communityVibe: data.community_vibe,
    isWomenOnly: data.is_women_only,
    activeLevel: data.active_level,
    gymId: data.gym_id,
});

export const mapTribePost = (p: any): TribePost => ({
    id: p.id,
    tribeId: p.room_id || p.tribe_id,
    userId: p.user_id || p.creator_id,
    content: p.content || p.caption || '',
    imageUrl: p.image_url,
    type: p.type || (p.image_url ? 'image' : 'text'),
    progressData: p.progress_data,
    createdAt: p.created_at,
    userName: p.users?.name || 'Anonymous',
    userAvatar: p.users?.avatar_url,
    reactions: p.room_post_reactions || [],
    commentsCount: parseInt(p.room_post_comments?.[0]?.count || '0'),
});

const TIMEOUT_MS = 8000;

const withTimeout = (promise: Promise<any>, name: string) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${name} took too long.`)), TIMEOUT_MS)
        )
    ]);
};

export const tribeService = {
    async fetchTribes(): Promise<Tribe[]> {
        console.log('[tribeService] fetchTribes: starting...');
        try {
            const query = (supabase as any)
                .from('rooms')
                .select(`
                    *,
                    room_members(count)
                `)
                .eq('active', true);

            const { data, error } = await withTimeout(query, 'fetchTribes') as any;

            if (error) throw error;
            console.log('[tribeService] fetchTribes success. count:', data?.length);
            return (data || []).map(mapTribe);
        } catch (e: any) {
            console.error('[tribeService] fetchTribes error:', e.message);
            return [];
        }
    },

    async searchTribes(term: string): Promise<Tribe[]> {
        console.log('[tribeService] searchTribes:', term);
        try {
            const query = (supabase as any)
                .from('rooms')
                .select(`
                    *,
                    room_members(count)
                `)
                .eq('active', true)
                .ilike('name', `%${term}%`);

            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(mapTribe);
        } catch (e: any) {
            console.error('[tribeService] searchTribes error:', e.message);
            return [];
        }
    },

    async getUserTribe(userId: string): Promise<Tribe | null> {
        console.log('[tribeService] getUserTribe for:', userId);
        try {
            const query = (supabase as any)
                .from('room_members')
                .select(`
                    room_id,
                    joined_at,
                    rooms!inner(*)
                `)
                .eq('user_id', userId)
                .eq('rooms.active', true)
                .order('joined_at', { ascending: false })
                .limit(1);

            const { data, error } = await withTimeout(query, 'getUserTribe') as any;

            if (error) throw error;

            if (data && data.length > 0 && data[0].rooms) {
                return mapTribe(data[0].rooms);
            }

            const { data: owned } = await (supabase as any)
                .from('rooms')
                .select('*')
                .eq('admin_id', userId)
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (owned) {
                console.log('[tribeService] User not member, but FOUND owned tribe:', owned.name);
                return mapTribe(owned);
            }

            return null;
        } catch (e: any) {
            console.error('[tribeService] getUserTribe error:', e.message);
            return null;
        }
    },

    async createTribe(tribeData: Partial<Tribe>, userId: string, gymId: string): Promise<Tribe> {
        console.log('[tribeService] createTribe STARTING', { name: tribeData.name, userId, gymId });

        try {
            const insertPayload = {
                name: tribeData.name,
                category: tribeData.category,
                description: tribeData.description || '',
                goal: tribeData.goal || '',
                rules: tribeData.rules || 'Welcome!',
                admin_id: userId,
                gym_id: gymId,
                active: true,
                max_members: tribeData.maxMembers || 50,
                duration_days: tribeData.durationDays || 60,
                start_date: tribeData.startDate || new Date().toISOString().split('T')[0],
                experience_level: tribeData.experienceLevel || 'All Levels',
                community_vibe: tribeData.communityVibe || 'Supportive',
                is_women_only: tribeData.isWomenOnly || false,
                active_level: tribeData.activeLevel || 'Daily Active'
            };

            const { data, error: insertError } = await (supabase as any)
                .from('rooms')
                .insert([insertPayload])
                .select();

            if (insertError) throw insertError;
            const createdTribe = data[0];

            await (supabase as any).from('room_members').insert([{
                room_id: createdTribe.id,
                user_id: userId
            }]);

            return mapTribe(createdTribe);
        } catch (error: any) {
            console.error('[tribeService] createTribe CRITICAL error:', error.message || error);
            throw error;
        }
    },

    async joinTribe(tribeId: string, userId: string) {
        // triggers handle limit, but we check capacity here
        const { data: tribe, error: tribeErr } = await (supabase as any)
            .from('rooms')
            .select('max_members, room_members(count)')
            .eq('id', tribeId)
            .single();

        if (!tribeErr && tribe) {
            const count = parseInt(tribe.room_members?.[0]?.count || '0');
            if (count >= (tribe.max_members || 50)) {
                throw new Error('This tribe has reached its maximum capacity.');
            }
        }

        const { error } = await (supabase as any)
            .from('room_members')
            .insert([{ room_id: tribeId, user_id: userId }]);
        if (error) throw error;
    },

    async leaveTribe(tribeId: string, userId: string) {
        const { error } = await (supabase as any)
            .from('room_members')
            .delete()
            .eq('room_id', tribeId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    // --- Tribe Posts & Social ---

    async fetchTribePosts(tribeId: string): Promise<TribePost[]> {
        // Check if tribe_posts exists (migration 2)
        const { data, error } = await (supabase as any)
            .from('tribe_posts')
            .select(`
                *,
                users(name, avatar_url),
                tribe_comments(count)
            `)
            .eq('tribe_id', tribeId)
            .order('created_at', { ascending: false });

        if (error) {
            // Fallback to legacy room_posts if migration 2 didn't run effectively or for backward compatibility
            console.warn('[tribeService] tribe_posts failed, trying room_posts fallback');
            const { data: legacy, error: legacyErr } = await (supabase as any)
                .from('room_posts')
                .select(`
                    *,
                    users(name, avatar_url),
                    room_post_reactions(user_id, reaction_type),
                    room_post_comments(count)
                `)
                .eq('room_id', tribeId)
                .order('created_at', { ascending: false });

            if (legacyErr) throw legacyErr;
            return (legacy || []).map(mapTribePost);
        }

        return (data || []).map(mapTribePost);
    },

    async uploadTribeMedia(tribeId: string, userId: string, uri: string): Promise<string> {
        const fileExt = uri.split('.').pop();
        const fileName = `${tribeId}/${userId}_${Date.now()}.${fileExt}`;
        const filePath = `tribe_assets/${fileName}`;

        // Convert URI to Blob if possible (browser/native handling varies)
        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
            .from('tribe-assets')
            .upload(fileName, blob, { contentType: `image/${fileExt}` });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('tribe-assets')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    async createTribePost(tribeId: string, userId: string, caption: string, imageUrl?: string): Promise<any> {
        const payload: any = {
            tribe_id: tribeId,
            creator_id: userId,
            caption: caption,
            image_url: imageUrl || ''
        };

        const { data, error } = await (supabase as any)
            .from('tribe_posts')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async addReaction(postId: string, userId: string, reactionType: string) {
        const { error } = await (supabase as any)
            .from('room_post_reactions')
            .upsert({
                post_id: postId,
                user_id: userId,
                reaction_type: reactionType
            }, { onConflict: 'post_id,user_id' });
        if (error) throw error;
    },

    async removeReaction(postId: string, userId: string) {
        const { error } = await (supabase as any)
            .from('room_post_reactions')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userId);
        if (error) throw error;
    },

    async addComment(postId: string, userId: string, content: string): Promise<any> {
        const { data, error } = await (supabase as any)
            .from('tribe_comments')
            .insert([{
                post_id: postId,
                user_id: userId,
                content
            }])
            .select('*, users(name, avatar_url)')
            .single();
        if (error) throw error;
        return data;
    },

    async fetchComments(postId: string): Promise<any[]> {
        const { data, error } = await (supabase as any)
            .from('tribe_comments')
            .select('*, users(name, avatar_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return DataMapper.fromDb(data || []);
    },

    async fetchTribeMembers(tribeId: string): Promise<any[]> {
        const { data, error } = await (supabase as any)
            .from('room_members')
            .select('user_id, users(*)')
            .eq('room_id', tribeId);
        if (error) throw error;
        return DataMapper.fromDb((data || []).map((m: any) => m.users));
    },

    async updateTribeSettings(tribeId: string, updates: Partial<Tribe>): Promise<Tribe> {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.goal !== undefined) dbUpdates.goal = updates.goal;
        if (updates.rules !== undefined) dbUpdates.rules = updates.rules;
        if (updates.maxMembers !== undefined) dbUpdates.max_members = updates.maxMembers;
        if (updates.durationDays !== undefined) dbUpdates.duration_days = updates.durationDays;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.experienceLevel !== undefined) dbUpdates.experience_level = updates.experienceLevel;
        if (updates.communityVibe !== undefined) dbUpdates.community_vibe = updates.communityVibe;
        if (updates.isWomenOnly !== undefined) dbUpdates.is_women_only = updates.isWomenOnly;
        if (updates.activeLevel !== undefined) dbUpdates.active_level = updates.activeLevel;

        const { data, error } = await (supabase as any)
            .from('rooms')
            .update(dbUpdates)
            .eq('id', tribeId)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Update failed.');
        return mapTribe(data[0]);
    },

    async deleteTribe(tribeId: string) {
        return await (supabase as any)
            .from('rooms')
            .update({ active: false })
            .eq('id', tribeId)
            .select();
    },

    async fetchTribeLeaderboard(tribeId: string): Promise<any[]> {
        try {
            const members = await this.fetchTribeMembers(tribeId);
            if (!members.length) return [];
            const memberIds = members.map((m: any) => m.id);

            const now = new Date();
            const start = startOfWeek(now, { weekStartsOn: 1 });
            const end = endOfWeek(now, { weekStartsOn: 1 });

            const { data: workouts, error } = await (supabase as any)
                .from('workout_sessions')
                .select('user_id, completed_at, exercise_id')
                .in('user_id', memberIds)
                .gte('completed_at', start.toISOString())
                .lte('completed_at', end.toISOString());

            if (error) throw error;

            const leaderboard = members.map((member: any) => {
                const userWorkouts = (workouts || []).filter((w: any) => w.user_id === member.id);
                const points = userWorkouts.length * 10;
                const weeklyActivity = Array(7).fill('none');

                userWorkouts.forEach((w: any) => {
                    const date = parseISO(w.completed_at);
                    let dayIndex = date.getDay() - 1;
                    if (dayIndex === -1) dayIndex = 6;
                    if (dayIndex >= 0 && dayIndex < 7) weeklyActivity[dayIndex] = 'full';
                });

                return { user: member, points, weeklyActivity, rank: 0 };
            });

            if (leaderboard.length < 5) {
                const dummiesNeed = 5 - leaderboard.length;
                for (let i = 0; i < dummiesNeed; i++) {
                    const dummyNames = ['Michael', 'Erin', 'Ajai', 'Virginia', 'Nijad', 'Sarah', 'David'];
                    const name = dummyNames[i % dummyNames.length] + ' (Bot)';
                    const weeklyActivity = Array(7).fill('none');
                    let pts = 0;
                    const daysActive = Math.floor(Math.random() * 4) + 1;
                    for (let d = 0; d < daysActive; d++) {
                        const dayIdx = Math.floor(Math.random() * 7);
                        if (weeklyActivity[dayIdx] === 'none') {
                            weeklyActivity[dayIdx] = 'full';
                            pts += 10;
                        }
                    }
                    leaderboard.push({
                        user: { id: `dummy_${i}`, name: name, avatarUrl: null, isBot: true },
                        points: pts,
                        weeklyActivity,
                        rank: 0
                    });
                }
            }
            leaderboard.sort((a: any, b: any) => b.points - a.points);
            leaderboard.forEach((item: any, index: number) => { item.rank = index + 1; });
            return leaderboard;
        } catch (error: any) {
            console.error('[tribeService] fetchLeaderboard error:', error);
            return [];
        }
    }
};
