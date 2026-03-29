
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { designSystem } from '../../theme/designSystem';

interface PostItemProps {
    post: any;
    currentUserId: string;
    onReact: (postId: string, reaction: string) => void;
    onRemoveReaction: (postId: string) => void;
    onReply: (postId: string) => void;
    onDelete: (postId: string) => void;
    isAdmin: boolean;
    theme: any;
    isDark: boolean;
}

export const PostItem = ({
    post,
    currentUserId,
    onReact,
    onRemoveReaction,
    onReply,
    onDelete,
    isAdmin,
    theme,
    isDark
}: PostItemProps) => {

    // Aggregate reactions
    const reactionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        const myReactions: Set<string> = new Set();

        if (post.reactions) {
            post.reactions.forEach((r: any) => {
                counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
                if (r.user_id === currentUserId) {
                    myReactions.add(r.reaction_type);
                }
            });
        }
        return { counts, myReactions };
    }, [post.reactions, currentUserId]);

    const handleReactionPress = (type: string) => {
        if (reactionCounts.myReactions.has(type)) {
            onRemoveReaction(post.id);
        } else {
            onReact(post.id, type);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                {post.userAvatar ? (
                    <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.placeholderAvatar, { backgroundColor: theme.backgroundInput }]}>
                        <Text style={{ color: theme.textSecondary }}>{post.userName?.[0]}</Text>
                    </View>
                )}
                <View style={styles.headerText}>
                    <Text style={[styles.name, { color: theme.text }]}>{post.userName}</Text>
                    <Text style={[styles.time, { color: theme.textSecondary }]}>
                        {format(new Date(post.createdAt), 'MMM d, h:mm a')}
                    </Text>
                </View>
                {isAdmin && (
                    <TouchableOpacity onPress={() => onDelete(post.id)} style={styles.deleteButton}>
                        <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={[
                styles.contentBubble,
                isDark ? designSystem.glass.dark : designSystem.glass.light,
                { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.8)' }
            ]}>
                <Text style={[styles.content, { color: theme.text }]}>{post.content}</Text>

                {post.type === 'progress' && (
                    <View style={[styles.badge, { borderColor: '#FFD700', backgroundColor: '#FFD70015' }]}>
                        <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                        <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: 'bold' }}>Workout Completed!</Text>
                    </View>
                )}
            </View>

            {/* Actions Row */}
            <View style={styles.actionsRow}>
                <View style={styles.reactionsContainer}>
                    {['🔥', '👏', '❤️'].map(emoji => {
                        const type = emoji === '🔥' ? 'fire' : emoji === '👏' ? 'clap' : 'heart';
                        const isActive = reactionCounts.myReactions.has(type);
                        const count = reactionCounts.counts[type] || 0;

                        return (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.reactionButton,
                                    isActive && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                                ]}
                                onPress={() => handleReactionPress(type)}
                            >
                                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                                {count > 0 && (
                                    <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>{count}</Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity
                    style={styles.replyButton}
                    onPress={() => onReply(post.id)}
                >
                    <MaterialCommunityIcons name="comment-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.replyText, { color: theme.textSecondary }]}>
                        {post.commentsCount > 0 ? `${post.commentsCount} Replies` : 'Reply'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
    placeholderAvatar: { justifyContent: 'center', alignItems: 'center' },
    headerText: { flex: 1 },
    name: { fontWeight: 'bold', fontSize: 14 },
    time: { fontSize: 11, marginTop: 1 },
    deleteButton: { padding: 5 },
    contentBubble: {
        padding: 12,
        borderRadius: 16,
        borderTopLeftRadius: 4,
        marginBottom: 8,
    },
    content: { fontSize: 15, lineHeight: 22 },
    badge: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        alignSelf: 'flex-start'
    },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 42 },
    reactionsContainer: { flexDirection: 'row', gap: 6 },
    reactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    reactionCount: { fontSize: 11, marginLeft: 4, fontWeight: '600' },
    replyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 5 },
    replyText: { fontSize: 12, fontWeight: '500' }
});
