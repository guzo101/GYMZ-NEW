// Analytics and Event Tracking Service for Tribes
// Tracks user interactions to provide insights and personalized recommendations

export interface AnalyticsEvent {
    eventName: string;
    properties?: Record<string, any>;
    timestamp?: Date;
    userId?: string;
}

export const analyticsService = {
    /**
     * Track a generic event
     */
    trackEvent(eventName: string, properties: Record<string, any> = {}) {
        const event: AnalyticsEvent = {
            eventName,
            properties,
            timestamp: new Date(),
        };

        console.log('[Analytics]', eventName, properties);

        // TODO: Send to analytics backend (Firebase, Amplitude, etc.)
        // For now, we just log to console
    },

    /**
     * Track button presses for engagement analysis
     */
    trackButtonPress(buttonId: string, context: string, metadata: Record<string, any> = {}) {
        this.trackEvent('button_press', {
            buttonId,
            context,
            ...metadata,
        });
    },

    /**
     * Track tribe-specific interactions
     */
    trackTribeInteraction(action: string, tribeId: string, metadata: Record<string, any> = {}) {
        this.trackEvent('tribe_interaction', {
            action,
            tribeId,
            ...metadata,
        });
    },

    /**
     * Track workout sharing in tribes
     */
    trackWorkoutShare(tribeId: string, workoutType: string) {
        this.trackEvent('workout_shared', {
            tribeId,
            workoutType,
        });
    },

    /**
     * Track tribe creation
     */
    trackTribeCreated(tribeId: string, category: string) {
        this.trackEvent('tribe_created', {
            tribeId,
            category,
        });
    },

    /**
     * Track tribe joining
     */
    trackTribeJoined(tribeId: string) {
        this.trackEvent('tribe_joined', {
            tribeId,
        });
    },

    /**
     * Track tribe leaving
     */
    trackTribeLeft(tribeId: string, duration: number) {
        this.trackEvent('tribe_left', {
            tribeId,
            duration, // How long they were a member (in days)
        });
    },

    /**
     * Track post creation in tribes
     */
    trackPostCreated(tribeId: string, postType: 'text' | 'progress') {
        this.trackEvent('tribe_post_created', {
            tribeId,
            postType,
        });
    },

    /**
     * Track reactions/likes
     */
    trackReaction(tribeId: string, postId: string, reactionType: string) {
        this.trackEvent('tribe_reaction', {
            tribeId,
            postId,
            reactionType,
        });
    },

    /**
     * Track achievement unlocks
     */
    trackAchievementUnlocked(achievementType: string, tribeId: string) {
        this.trackEvent('achievement_unlocked', {
            achievementType,
            tribeId,
        });
    },

    /**
     * Track screen views
     */
    trackScreenView(screenName: string, metadata: Record<string, any> = {}) {
        this.trackEvent('screen_view', {
            screenName,
            ...metadata,
        });
    },
};
