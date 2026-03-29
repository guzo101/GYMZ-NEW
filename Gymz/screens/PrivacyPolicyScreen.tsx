import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';

export default function PrivacyPolicyScreen() {
    const { theme, isDark } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={5} />
            <ScreenHeader title="Privacy Policy" showBackButton />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.text }]}>Data Collection & Use</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        At Gymz Fitness, we take your privacy seriously. This policy explains how we collect, use, and protect your data.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>1. Information We Collect</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        We collect personal information such as your name, email, height, weight, and fitness goals to provide a personalized experience. We also collect activity data (check-ins, calories, water) to track your progress.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>2. How We Use Data</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        Your data is used to calculate health metrics (like BMI), provide AI-driven coaching, and manage your gym access via your Unique ID (#XXXXX). We do not share your fitness data with 3rd parties.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>3. Data Security</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        All data is stored securely using Supabase's encrypted database systems. Access is restricted to authorized systems and administrators required to support your membership.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>4. Your Rights</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        You can request a copy of your data or deletion of your account at any time by contacting our support team or using the Delete account option in Settings → Account.
                    </Text>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textMuted }]}>
                            Last Updated: February 2024
                        </Text>
                    </View>
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
    contentCard: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 12,
    },
    footer: {
        marginTop: 32,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        fontStyle: 'italic',
    }
});
