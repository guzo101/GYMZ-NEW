import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';

export default function HelpCenterScreen() {
    const { theme, isDark } = useTheme();

    const faqs = [
        {
            q: "Can I check in without internet?",
            a: "Absolutely. Your Gym Entry ID (e.g., #3595^) is unique to you and does not require an active data connection for scanners at the front desk. Your check-in history will sync once you are back online."
        },
        {
            q: "How does XP and Leveling work?",
            a: "Every 1,000 XP you earn moves you to the next level. You gain XP by entering the gym, logging workouts, and tracking your nutrition."
        },
        {
            q: "What are the Loyalty Tiers?",
            a: "Progress through Bronze, Gold, Platinum, and Diamond tiers as you level up. Each tier signifies your dedication and consistency in the Gymz community."
        },
        {
            q: "What are 'Tribes'?",
            a: "Tribes are social communities where members connect, share tips, and compete on leaderboards. You can join a Tribe that matches your vibe (e.g., Competitive, Supportive) and goal (e.g., Strength, Yoga)."
        }
    ];

    const handleContactSupport = () => {
        Linking.openURL('mailto:support.gymz@gmail.com');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={4} />
            <ScreenHeader title="Help Center" showBackButton />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.heroSection}>
                    <View style={[styles.heroIcon, { backgroundColor: theme.primary + '20' }]}>
                        <MaterialCommunityIcons name="help-circle" size={40} color={theme.primary} />
                    </View>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>How can we help?</Text>
                    <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                        Find answers to common questions or reach out to our team.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>FREQUENTLY ASKED QUESTIONS</Text>
                    {faqs.map((faq, index) => (
                        <View key={index} style={[styles.faqCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                            <Text style={[styles.faqQuestion, { color: theme.text }]}>{faq.q}</Text>
                            <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>{faq.a}</Text>
                        </View>
                    ))}
                </View>

                <View style={[styles.contactCard, { backgroundColor: theme.primary }]}>
                    <MaterialCommunityIcons name="email-outline" size={32} color="#FFF" />
                    <View style={styles.contactText}>
                        <Text style={styles.contactTitle}>Still need help?</Text>
                        <Text style={styles.contactSubtitle}>Our support team is available 24/7 to assist you.</Text>
                    </View>
                    <TouchableOpacity style={styles.contactBtn} onPress={handleContactSupport}>
                        <Text style={[styles.contactBtnText, { color: theme.primary }]}>EMAIL US</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    heroIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 32,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 16,
        letterSpacing: 1,
    },
    faqCard: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
    },
    faqQuestion: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    faqAnswer: {
        fontSize: 14,
        lineHeight: 20,
    },
    contactCard: {
        padding: 24,
        borderRadius: 24,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 15,
            },
            android: {
                elevation: 10,
            }
        })
    },
    contactText: {
        alignItems: 'center',
    },
    contactTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    contactSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        textAlign: 'center',
    },
    contactBtn: {
        backgroundColor: '#FFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    contactBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
