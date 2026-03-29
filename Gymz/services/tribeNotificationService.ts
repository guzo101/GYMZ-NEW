import { supabase } from './supabase';
import { analyticsService } from './analyticsService';

/**
 * Tribe Notification Service
 * Handles real-time notifications for tribe activities
 */
export const tribeNotificationService = {
    /**
     * Subscribe to tribe post notifications
     */
    subscribeToTribePosts(tribeId: string, userId: string, onNewPost: (post: any) => void) {
        // Listen to legacy room_posts
        const legacyChannel = supabase
            .channel(`room_posts_${tribeId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_posts',
                    filter: `room_id=eq.${tribeId}`,
                },
                (payload) => {
                    if (payload.new.user_id !== userId) {
                        onNewPost(payload.new);
                    }
                }
            )
            .subscribe();

        // Listen to new tribe_posts
        const tribeChannel = supabase
            .channel(`tribe_posts_${tribeId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'tribe_posts',
                    filter: `tribe_id=eq.${tribeId}`,
                },
                (payload) => {
                    if (payload.new.creator_id !== userId) {
                        onNewPost(payload.new);
                    }
                }
            )
            .subscribe();

        return { legacyChannel, tribeChannel };
    },

    /**
     * Subscribe to new member joins
     */
    subscribeToNewMembers(tribeId: string, onNewMember: (member: any) => void) {
        const channel = supabase
            .channel(`tribe_members_${tribeId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_members',
                    filter: `room_id=eq.${tribeId}`,
                },
                (payload) => {
                    console.log('[TribeNotification] New member joined:', payload.new);
                    onNewMember(payload.new);
                }
            )
            .subscribe();

        return channel;
    },

    /**
     * Subscribe to post reactions
     */
    subscribeToReactions(tribeId: string, onReactionChange: () => void) {
        const channel = supabase
            .channel(`tribe_reactions_${tribeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'room_post_reactions',
                },
                () => {
                    onReactionChange();
                }
            )
            .subscribe();
        return channel;
    },

    /**
     * Subscribe to post comments
     */
    subscribeToComments(tribeId: string, onCommentChange: () => void) {
        // Legacy comments
        const legacyChannel = supabase
            .channel(`room_comments_${tribeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'room_post_comments',
                },
                () => onCommentChange()
            )
            .subscribe();

        // New tribe comments
        const tribeChannel = supabase
            .channel(`tribe_comments_${tribeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tribe_comments',
                },
                () => onCommentChange()
            )
            .subscribe();

        return { legacyChannel, tribeChannel };
    },

    /**
     * Subscribe to workout completions for tribe members
     */
    subscribeToMemberWorkouts(memberIds: string[], onWorkoutComplete: (workout: any) => void) {
        const channel = supabase
            .channel('tribe_member_workouts')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'workout_sessions',
                },
                (payload) => {
                    if (memberIds.includes(payload.new.user_id)) {
                        onWorkoutComplete(payload.new);
                    }
                }
            )
            .subscribe();

        return channel;
    },

    /**
     * Unsubscribe from a channel or multiple channels
     */
    unsubscribe(channel: any) {
        if (!channel) return;
        if (channel.legacyChannel && channel.tribeChannel) {
            supabase.removeChannel(channel.legacyChannel);
            supabase.removeChannel(channel.tribeChannel);
        } else {
            supabase.removeChannel(channel);
        }
    },
};
