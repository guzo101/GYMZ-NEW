import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';

export default function TermsOfServiceScreen() {
    const { theme, isDark } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={6} />
            <ScreenHeader title="Terms of Service" showBackButton />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.text }]}>Terms & Conditions</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        Welcome to Gymz Fitness. By using our application and facilities, you agree to the following terms and conditions.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>1. Membership Eligibility</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        Users must be 18 years of age or older to purchase a membership. Users under 18 must have parental or guardian consent to use the facilities.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>2. Health and Safety</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        You should consult with a physician before starting any exercise program. By using Gymz, you assume all risks associated with physical activity. Gymz is not liable for injuries sustained during workouts.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>3. Membership Payments</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        Payments are non-refundable. Subscriptions automatically expire at the end of the term. Access to the gym requires an active membership and a valid QR code check-in.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>4. Code of Conduct & Tiers</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        Respect others and follow gym etiquette. As you participate, you will progress through our Bronze, Gold, Platinum, and Diamond tiers based on your XP. Gymz reserves the right to terminate memberships for disruptive behavior.
                    </Text>

                    <Text style={[styles.subtitle, { color: theme.text }]}>5. Dynamic Content</Text>
                    <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
                        Gymz uses AI and dynamic algorithms to provide guidance. This is for informational purposes and should not replace professional medical or nutritional advice.
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
