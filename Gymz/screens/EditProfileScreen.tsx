import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    Image,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { ScreenHeader } from '../components/ScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { canonicalizeGoal } from '../utils/healthMath';
import { DataMapper } from '../utils/dataMapper';

export default function EditProfileScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        goal: '',
        age: '',
        height: '',
        weight: '',
        gender: '',
        preferredWorkoutTime: '',
        avatarUrl: null as string | null,
    });
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const fetchProfile = async () => {
        if (!user?.id) return;

        console.log('[EditProfile] Starting fetch for user:', user.id);
        try {
            const { data, error } = await (supabase as any)
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('[EditProfile] Database error:', error);
                Alert.alert('Database Error', `Failed to load profile: ${error.message}`);
                setLoading(false);
                return;
            }

            if (!data) {
                console.error('[EditProfile] No data returned for user');
                Alert.alert('No Data', 'No profile found for this user.');
                setLoading(false);
                return;
            }

            console.log('[EditProfile] Data fetched successfully');
            const d = DataMapper.fromDb<any>(data);

            setFormData({
                firstName: d.firstName || d.name?.split(' ')[0] || '',
                lastName: d.lastName || (d.name?.includes(' ') ? d.name.substring(d.name.indexOf(' ') + 1) : '') || '',
                goal: d.primaryObjective || d.goal || '',
                age: d.age?.toString() || '',
                height: d.height?.toString() || '',
                weight: d.weight?.toString() || '',
                gender: d.gender || '',
                preferredWorkoutTime: d.preferredWorkoutTime?.substring(0, 5) || '',
                avatarUrl: d.avatarUrl || null,
            });

        } catch (err) {
            console.error('[EditProfile] Fetch crashed:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            Alert.alert('Error', `Failed to load profile: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) {
            fetchProfile();
        }
    }, [user?.id]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            setImageUri(asset.uri);
            setImageBase64(asset.base64 ?? null);
        }
    };

    const uploadImage = async (base64: string, uri: string) => {
        try {
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeType = fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg';
            const fileName = `user_${user?.id}_${Date.now()}.${fileExt}`;
            const filePath = fileName;

            const arrayBuffer = decode(base64);

            console.log(`[EditProfile] Uploading to user-avatars bucket as: ${filePath}`);

            const { data, error } = await supabase.storage
                .from('user-avatars')
                .upload(filePath, arrayBuffer, {
                    contentType: mimeType,
                    upsert: true,
                });

            if (error) {
                console.error('[EditProfile] Supabase Storage Error:', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('user-avatars')
                .getPublicUrl(filePath);
            return publicUrl;
        } catch (error: any) {
            console.error('[EditProfile] Error in uploadImage:', error);
            const msg = error?.message || 'Unknown error';
            if (msg.includes('Network request failed')) {
                throw new Error('Unable to upload. Please check your internet connection and try again.');
            }
            throw new Error(`Avatar upload failed: ${msg}`);
        }
    };

    const handleSave = async () => {

        // Robust Parsing Helpers
        const cleanInt = (val: string) => {
            const parsed = parseInt(val.replace(/[^0-9]/g, ''));
            return isNaN(parsed) ? null : parsed;
        };

        const cleanFloat = (val: string) => {
            const parsed = parseFloat(val.replace(/[^0-9.]/g, ''));
            return isNaN(parsed) ? null : parsed;
        };

        setSaving(true);

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                throw sessionError;
            }

            if (!user?.id) {
                throw new Error('Authentication lost. Please log in again.');
            }

            const fullName = `${formData.firstName} ${formData.lastName}`.trim();
            let avatarUrl = formData.avatarUrl;

            if (imageUri) {
                if (!imageBase64) {
                    throw new Error('Image data is missing. Please select the photo again.');
                }
                try {
                    avatarUrl = await uploadImage(imageBase64, imageUri);
                } catch (err: any) {
                    Alert.alert('Upload Failed', err.message || 'Could not upload profile picture. Please try again.');
                    throw err;
                }
            }

            console.log('[EditProfile] Updating user record:', user.id);

            const canonicalGoal = canonicalizeGoal(formData.goal);

            const updates = DataMapper.toDb({
                firstName: formData.firstName.trim().substring(0, 50),
                lastName: formData.lastName.trim().substring(0, 50),
                name: fullName.substring(0, 100),
                goal: canonicalGoal,
                primaryObjective: canonicalGoal,
                age: cleanInt(formData.age),
                height: cleanFloat(formData.height),
                weight: cleanFloat(formData.weight),
                gender: formData.gender || 'male',
                preferredWorkoutTime: formData.preferredWorkoutTime || null,
                avatarUrl: avatarUrl,
                updatedAt: new Date().toISOString()
            });

            const { error, count } = await (supabase as any)
                .from('users')
                .update(updates)
                .eq('id', user.id)
                .select('id', { count: 'exact' });

            if (error) {
                throw error;
            }

            if (count === 0) {
                throw new Error('Profile update failed: No record found or permission denied.');
            }

            await refreshUser();

            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (err: any) {
            const msg = err?.message || 'An unexpected error occurred.';
            if (!msg.includes('Image data is missing') && !msg.includes('Avatar upload failed') && !msg.includes('Unable to upload')) {
                Alert.alert('Error', msg);
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <ScreenHeader title="Edit Profile" showBackButton />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={pickImage} style={[styles.avatarWrapper, { borderColor: theme.border }]}>
                        {imageUri || formData.avatarUrl ? (
                            <Image
                                source={{ uri: imageUri || formData.avatarUrl! }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundCard }]}>
                                <MaterialCommunityIcons name="account" size={60} color={theme.textMuted} />
                            </View>
                        )}
                        <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                            <MaterialCommunityIcons name="camera" size={20} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickImage}>
                        <Text style={[styles.changePhotoText, { color: theme.primary }]}>Change Photo</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>NAME</Text>
                    <View style={styles.row}>
                        <View style={styles.halfInputContainer}>
                            <TextInput
                                style={[styles.input, styles.halfInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                                value={formData.firstName}
                                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                                placeholder="First Name"
                                placeholderTextColor={theme.textMuted}
                                textAlign="left"
                                returnKeyType="next"
                                autoCorrect={false}
                            />
                        </View>
                        <View style={styles.halfInputContainer}>
                            <TextInput
                                style={[styles.input, styles.halfInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                                value={formData.lastName}
                                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                                placeholder="Last Name"
                                placeholderTextColor={theme.textMuted}
                                textAlign="left"
                                returnKeyType="done"
                                autoCorrect={false}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>CURRENT GOAL</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                        value={formData.goal}
                        onChangeText={(text) => setFormData({ ...formData, goal: text })}
                        placeholder="e.g. Lose weight, Muscle gain"
                        placeholderTextColor={theme.textMuted}
                    />
                </View>

                <View style={[styles.section, { flex: 1 }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>AGE (YRS)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                        value={formData.age}
                        onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>HEIGHT (CM)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                        value={formData.height}
                        onChangeText={(text) => setFormData({ ...formData, height: text.replace(/[^0-9.]/g, '') })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>WEIGHT (KG)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                        value={formData.weight}
                        onChangeText={(text) => setFormData({ ...formData, weight: text.replace(/[^0-9.]/g, '') })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>GOLD HOUR (PREFERRED WORKOUT TIME)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
                        value={formData.preferredWorkoutTime}
                        onChangeText={(text) => setFormData({ ...formData, preferredWorkoutTime: text })}
                        placeholder="HH:MM (e.g. 06:30)"
                        placeholderTextColor={theme.textMuted}
                        maxLength={5}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>GENDER</Text>
                    <View style={styles.genderRow}>
                        {['male', 'female'].map((g) => (
                            <TouchableOpacity
                                key={g}
                                style={[
                                    styles.genderOption,
                                    { backgroundColor: theme.backgroundCard, borderColor: theme.border },
                                    formData.gender === g && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                                ]}
                                onPress={() => setFormData({ ...formData, gender: g })}
                            >
                                <MaterialCommunityIcons
                                    name={g === 'male' ? 'gender-male' : 'gender-female'}
                                    size={24}
                                    color={formData.gender === g ? theme.primary : theme.textMuted}
                                />
                                <Text style={[styles.genderLabel, { color: formData.gender === g ? theme.primary : theme.textSecondary }]}>
                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <LinearGradient
                        colors={[theme.primary, theme.primaryLight]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveGradient}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.saveText}>SAVE CHANGES</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
    },
    input: {
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        textAlignVertical: 'center',
        includeFontPadding: false,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
            android: {
                textAlignVertical: 'center',
            }
        })
    },
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    halfInputContainer: {
        flex: 1,
        minWidth: 0,
        maxWidth: '50%',
    },
    halfInput: {
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 12,
    },
    genderOption: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
    },
    genderLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    saveButton: {
        marginTop: 12,
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
    },
    saveGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        padding: 4,
        position: 'relative',
        marginBottom: 12,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 56,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    changePhotoText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
