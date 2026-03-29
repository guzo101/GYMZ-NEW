import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Image, useWindowDimensions, ScrollView, Alert, Platform, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { ComparisonSlider, ComparisonSliderRef } from './ComparisonSlider';
import { useTheme } from '../../hooks/useTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import { progressService } from '../../services/progressService';
import { supabase } from '../../services/supabase';
import { format, parseISO } from 'date-fns';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

interface Snapshot {
    id: string;
    imageUrl: string;
    date: string;
    weight?: number;
    notes?: string;
}

export const SnapshotsView = () => {
    const { width } = useWindowDimensions();
    const cardWidth = (width - 48) / 2; // Adjust for padding, updates on resize
    const { theme, isDark } = useTheme();
    const { user } = useAuth();
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<'all' | 'slider'>('all');
    const [dragMode, setDragMode] = useState(false);
    const sliderRef = useRef<ComparisonSliderRef>(null);

    // Selection State for Comparison
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [comparisonMetrics, setComparisonMetrics] = useState<{ [key: string]: any }>({});

    // Unified Data Layer: Enriched Snapshots with Body Metrics
    const enrichedSnapshots = useMemo(() => {
        return snapshots.map(snap => {
            const correlatedMetric = comparisonMetrics[snap.id];
            return {
                ...snap,
                // Connection: Use snapshot weight first, but fallback to correlated body metric weight
                weight: snap.weight || correlatedMetric?.weight,
                bodyFat: correlatedMetric?.bodyFatPercentage
            };
        });
    }, [snapshots, comparisonMetrics]);

    // Journey Analytics
    const journeyStats = useMemo(() => {
        if (enrichedSnapshots.length < 1) return null;
        const sorted = [...enrichedSnapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const first = sorted[0];
        const latest = sorted[sorted.length - 1];
        const activeDays = Math.max(1, Math.floor((new Date(latest.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)));

        const startWeight = first.weight || 0;
        const latestWeight = latest.weight || 0;
        const totalProgress = (startWeight && latestWeight) ? latestWeight - startWeight : 0;

        return {
            totalProgress,
            activeDays,
            startImg: first.imageUrl,
            latestImg: latest.imageUrl,
            startDate: format(parseISO(first.date), 'MMM dd, yyyy'),
            latestDate: format(parseISO(latest.date), 'MMM dd, yyyy'),
            startMetrics: { weight: startWeight, bodyFat: first.bodyFat },
            latestMetrics: { weight: latestWeight, bodyFat: latest.bodyFat }
        };
    }, [enrichedSnapshots]);

    // Comparison Pair Configuration
    const comparisonPair = useMemo(() => {
        if (selectedIds.length >= 2) {
            const pair = enrichedSnapshots.filter(s => selectedIds.includes(s.id))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const before = pair[0];
            const after = pair[pair.length - 1];

            return {
                beforeId: before.id,
                afterId: after.id,
                beforeImage: before.imageUrl,
                afterImage: after.imageUrl,
                beforeDate: format(parseISO(before.date), 'MMM dd, yyyy'),
                afterDate: format(parseISO(after.date), 'MMM dd, yyyy'),
                beforeMetrics: {
                    weight: before.weight,
                    bodyFat: before.bodyFat
                },
                afterMetrics: {
                    weight: after.weight,
                    bodyFat: after.bodyFat
                },
            };
        }

        // Fallback to journey extremes
        if (journeyStats && enrichedSnapshots.length >= 2) {
            const sorted = [...enrichedSnapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const first = sorted[0];
            const latest = sorted[sorted.length - 1];
            return {
                beforeId: first.id,
                afterId: latest.id,
                beforeImage: journeyStats.startImg,
                afterImage: journeyStats.latestImg,
                beforeDate: journeyStats.startDate,
                afterDate: journeyStats.latestDate,
                beforeMetrics: journeyStats.startMetrics,
                afterMetrics: journeyStats.latestMetrics,
            };
        }
        return null;
    }, [selectedIds, enrichedSnapshots, journeyStats]);

    // Grouping by Month
    const monthlyGroups = useMemo(() => {
        const groups: { [key: string]: (typeof enrichedSnapshots)[number][] } = {};
        enrichedSnapshots.forEach(snap => {
            const monthYear = format(parseISO(snap.date), 'MMMM yyyy');
            if (!groups[monthYear]) groups[monthYear] = [];
            groups[monthYear].push(snap);
        });
        return Object.entries(groups).map(([name, snaps]) => ({ name, snaps }));
    }, [enrichedSnapshots]);

    const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);
    const [editWeight, setEditWeight] = useState('');
    const [editDate, setEditDate] = useState('');

    useEffect(() => {
        if (user?.id) {
            fetchSnapshots();
        }
    }, [user?.id]);

    const fetchSnapshots = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await progressService.getSnapshots(user.id);
            setSnapshots(data);

            // Fetch deep metrics for snapshots (body fat etc)
            fetchDeepMetrics(user.id, data);
        } catch (error) {
            console.error('Error fetching snapshots:', error);
            Alert.alert('Error', 'Failed to load snapshots.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchDeepMetrics = async (userId: string, snaps: Snapshot[]) => {
        try {
            // Fetch both body metrics and user profile data to ensure we have a fallback
            const [metrics, profileRes] = await Promise.all([
                progressService.getBodyMetrics(userId, 730),
                (supabase as any).from('users').select('weight').eq('id', userId).single()
            ]);
            const profile = profileRes.data as any;

            const metricMap: { [key: string]: any } = {};

            snaps.forEach(snap => {
                // Connection Strategy: 
                // 1. Find the closest entry in body_metrics within 14 days
                // 2. Fallback to profile weight if it's the only data we have
                const snapDate = new Date(snap.date);
                const closest = metrics.filter(m => {
                    const mDate = new Date(m.date);
                    const diff = Math.abs(snapDate.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24);
                    return diff <= 14; // Widen window to 2 weeks
                }).sort((a, b) => {
                    const aDiff = Math.abs(snapDate.getTime() - new Date(a.date).getTime());
                    const bDiff = Math.abs(snapDate.getTime() - new Date(b.date).getTime());
                    return aDiff - bDiff;
                })[0];

                if (closest) {
                    metricMap[snap.id] = closest;
                } else if (profile?.weight) {
                    // Ultimate connection fallback: Use profile weight
                    metricMap[snap.id] = { weight: profile.weight };
                }
            });

            setComparisonMetrics(metricMap);
        } catch (err) {
            console.warn('[Snapshots] Deep metrics correlation failed', err);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) return prev.filter(mid => mid !== id);
            if (prev.length >= 2) {
                // Keep the latest selected, replace the older one
                return [prev[1], id];
            }
            return [...prev, id];
        });
    };

    const handleSnapshotPress = (snap: Snapshot) => {
        if (isSelectionMode) {
            toggleSelection(snap.id);
        } else {
            handleEdit(snap);
        }
    };

    const handleEdit = (snap: Snapshot) => {
        setEditingSnapshot(snap);
        setEditWeight(snap.weight?.toString() || '');
        setEditDate(snap.date);
    };

    const handleSaveEdit = async () => {
        if (!editingSnapshot) return;
        setLoading(true);
        try {
            const updates = {
                weight: editWeight ? parseFloat(editWeight) : undefined,
                date: editDate
            };
            const updated = await progressService.updateSnapshot(editingSnapshot.id, updates);
            if (updated) {
                setSnapshots(prev => prev.map(s => s.id === updated.id ? updated : s));
                setEditingSnapshot(null);
                Alert.alert('Success', 'Snapshot corrected.');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update snapshot.');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchSnapshots();
    };

    const handleAddSnapshot = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please grant camera roll permissions to upload snapshots.');
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
                base64: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                await uploadSnapshot(asset.uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const uploadSnapshot = async (uri: string) => {
        if (!user?.id) {
            Alert.alert('Error', 'User not authenticated.');
            return;
        }

        setLoading(true);

        try {
            const filename = `${user.id}/${Date.now()}.jpg`;
            let uploadResult;

            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                const blob = await response.blob();
                uploadResult = await supabase.storage
                    .from('user-snapshots')
                    .upload(filename, blob, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });
            } else {
                const formData = new FormData();
                formData.append('file', {
                    uri: uri,
                    name: filename,
                    type: 'image/jpeg',
                } as any);

                uploadResult = await supabase.storage
                    .from('user-snapshots')
                    .upload(filename, formData, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });
            }

            const { data: uploadData, error: uploadError } = uploadResult;

            if (uploadError) {
                console.error('[Snapshots] Supabase Storage Error:', uploadError);
                if (uploadError.message?.includes('not found') || (uploadError as any).status === 404) {
                    throw new Error('Storage bucket "user-snapshots" not found.');
                }
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('user-snapshots')
                .getPublicUrl(filename);

            let currentWeight = await progressService.getLatestWeight(user.id);

            const snapshotData = {
                imageUrl: publicUrl,
                date: new Date().toISOString().split('T')[0],
                weight: currentWeight || undefined,
            };

            const savedSnapshot = await progressService.addSnapshot(user.id, snapshotData);

            if (savedSnapshot) {
                setSnapshots(prev => [savedSnapshot, ...prev]);
                Alert.alert('Success', 'Moment captured successfully!');
            }
        } catch (error: any) {
            Alert.alert('Upload Failed', error.message || 'Error occurred during upload.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: string, index: number) => {
        Alert.alert(
            'Delete Snapshot',
            'Remove this from your journey?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await progressService.deleteSnapshot(id);
                            if (success) {
                                setSnapshots(prev => prev.filter(s => s.id !== id));
                            }
                        } catch (e) { Alert.alert('Error', 'Deletion failed.'); }
                    }
                }
            ]
        );
    };

    const handleSaveComparison = async () => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant gallery permissions to save the comparison.');
                return;
            }

            setLoading(true);

            // Calculate 1080px on the longest side
            const sliderWidth = width - 36;
            const sliderHeight = 240;
            const maxDimension = Math.max(sliderWidth, sliderHeight);
            const scaleMultiplier = 1080 / maxDimension;

            const targetWidth = Math.round(sliderWidth * scaleMultiplier);
            const targetHeight = Math.round(sliderHeight * scaleMultiplier);

            const uri = await captureRef(sliderRef, {
                format: 'png',
                quality: 1,
                width: targetWidth,
                height: targetHeight,
            });

            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert('Success', 'Comparison saved to your gallery!');
        } catch (error) {
            console.error('Save failed:', error);
            Alert.alert('Error', 'Failed to save the comparison.');
        } finally {
            setLoading(false);
        }
    };

    const handleShareComparison = async () => {
        try {
            setLoading(true);

            const sliderWidth = width - 36;
            const sliderHeight = 240;
            const maxDimension = Math.max(sliderWidth, sliderHeight);
            const scaleMultiplier = 1080 / maxDimension;

            const targetWidth = Math.round(sliderWidth * scaleMultiplier);
            const targetHeight = Math.round(sliderHeight * scaleMultiplier);

            const uri = await captureRef(sliderRef, {
                format: 'png',
                quality: 1,
                width: targetWidth,
                height: targetHeight,
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Error', 'Sharing is not available on this device.');
            }
        } catch (error) {
            console.error('Share failed:', error);
            Alert.alert('Error', 'Failed to share the comparison.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.mainContainer, { backgroundColor: theme.background }]}>
            {dragMode && viewMode === 'slider' && comparisonPair && (
                <Modal visible transparent animationType="fade">
                    <View style={StyleSheet.absoluteFill}>
                        <TouchableWithoutFeedback onPress={() => setDragMode(false)}>
                            <View style={styles.fullScreenOverlay} />
                        </TouchableWithoutFeedback>
                        <View style={styles.modalComparisonContainer} pointerEvents="box-none">
                        <View style={styles.modalComparisonContent} pointerEvents="auto">
                            <ComparisonSlider
                                ref={sliderRef}
                                beforeImage={comparisonPair.beforeImage}
                                afterImage={comparisonPair.afterImage}
                                beforeDate={comparisonPair.beforeDate}
                                afterDate={comparisonPair.afterDate}
                                beforeMetrics={comparisonPair.beforeMetrics}
                                afterMetrics={comparisonPair.afterMetrics}
                                dragMode={true}
                                onEditBefore={() => {
                                    const snap = snapshots.find(s => s.id === comparisonPair.beforeId);
                                    if (snap) handleEdit(snap);
                                }}
                                onEditAfter={() => {
                                    const snap = snapshots.find(s => s.id === comparisonPair.afterId);
                                    if (snap) handleEdit(snap);
                                }}
                            />
                            <View style={[styles.comparisonTools, { marginTop: 16 }]}>
                                <TouchableOpacity
                                    style={[styles.toolBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                                    onPress={() => setDragMode(false)}
                                >
                                    <MaterialCommunityIcons name="cursor-move" size={20} color="#FFF" />
                                    <Text style={[styles.toolLabel, { color: '#FFF' }]}>Exit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toolBtn, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                                    onPress={handleSaveComparison}
                                >
                                    <MaterialCommunityIcons name="download" size={20} color={theme.primary} />
                                    <Text style={[styles.toolLabel, { color: theme.text }]}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toolBtn, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                                    onPress={handleShareComparison}
                                >
                                    <MaterialCommunityIcons name="share-variant" size={20} color={theme.primary} />
                                    <Text style={[styles.toolLabel, { color: theme.text }]}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                    </View>
                </Modal>
            )}
            <ScrollView
                scrollEnabled={!dragMode}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                }
            >
                {/* Neural Progress Analytics */}
                {journeyStats && !isSelectionMode && (
                    <View style={styles.journeyHeader}>
                        <View style={styles.statBox}>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Transformation</Text>
                        </View>
                    </View>
                )}

                {/* Selection Mode Indicator */}
                {isSelectionMode && (
                    <BlurView intensity={20} style={[styles.selectionHeader, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}>
                        <View style={styles.selectionInfo}>
                            <Text style={[styles.selectionTitle, { color: theme.text }]}>Compare Photos</Text>
                            <Text style={[styles.selectionSubtitle, { color: theme.textSecondary }]}>
                                {selectedIds.length === 0 ? 'Select up to 2 photos' :
                                    selectedIds.length === 1 ? 'Select one more' : 'Ready to compare'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: theme.primary }]}
                            onPress={() => setIsSelectionMode(false)}
                        >
                            <Text style={styles.doneText}>Compare Progress</Text>
                        </TouchableOpacity>
                    </BlurView>
                )}

                <View style={styles.modeTabs}>
                    {[
                        { id: 'all', label: 'Feed' },
                        { id: 'slider', label: 'Compare Progress' }
                    ].map((mode) => (
                        <TouchableOpacity
                            key={mode.id}
                            style={[
                                styles.modeTab,
                                viewMode === mode.id && [styles.modeTabActive, { backgroundColor: theme.primary }]
                            ]}
                            onPress={() => setViewMode(mode.id as any)}
                        >
                            <Text style={[
                                styles.modeTabText,
                                { color: viewMode === mode.id ? '#FFF' : theme.textSecondary }
                            ]}>
                                {mode.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Main Comparison Section - hidden when in drag mode (shown in Modal instead) */}
                {viewMode === 'slider' && comparisonPair && !dragMode && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                    {selectedIds.length >= 2 ? 'Analysis: Custom Selection' : 'Journey Evolution'}
                                </Text>
                                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                                    {dragMode ? 'Drag to reposition • Tap outside to exit' : 'Scroll normally • Tap Reposition to drag'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.compareTrigger, { borderColor: theme.border }]}
                                onPress={() => {
                                    setIsSelectionMode(true);
                                    setViewMode('all');
                                }}
                            >
                                <MaterialCommunityIcons name="image-multiple" size={20} color={theme.primary} />
                                <Text style={[styles.compareTriggerText, { color: theme.text }]}>Select</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.comparisonSliderWrapper}>
                            <ComparisonSlider
                                ref={sliderRef}
                                beforeImage={comparisonPair.beforeImage}
                                afterImage={comparisonPair.afterImage}
                                beforeDate={comparisonPair.beforeDate}
                                afterDate={comparisonPair.afterDate}
                                beforeMetrics={comparisonPair.beforeMetrics}
                                afterMetrics={comparisonPair.afterMetrics}
                                dragMode={dragMode}
                                onEditBefore={() => {
                                    const snap = snapshots.find(s => s.id === comparisonPair.beforeId);
                                    if (snap) handleEdit(snap);
                                }}
                                onEditAfter={() => {
                                    const snap = snapshots.find(s => s.id === comparisonPair.afterId);
                                    if (snap) handleEdit(snap);
                                }}
                            />
                        </View>

                        <View style={styles.comparisonTools}>
                            <TouchableOpacity
                                style={[styles.toolBtn, { backgroundColor: dragMode ? theme.primary : theme.backgroundCard, borderColor: theme.border }]}
                                onPress={() => setDragMode(m => !m)}
                            >
                                <MaterialCommunityIcons name="cursor-move" size={20} color={dragMode ? '#FFF' : theme.primary} />
                                <Text style={[styles.toolLabel, { color: dragMode ? '#FFF' : theme.text }]}>{dragMode ? 'Exit' : 'Reposition'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toolBtn, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                                onPress={handleSaveComparison}
                            >
                                <MaterialCommunityIcons name="download" size={20} color={theme.primary} />
                                <Text style={[styles.toolLabel, { color: theme.text }]}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toolBtn, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                                onPress={handleShareComparison}
                            >
                                <MaterialCommunityIcons name="share-variant" size={20} color={theme.primary} />
                                <Text style={[styles.toolLabel, { color: theme.text }]}>Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.historySection}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Snapshot Feed</Text>
                        {!isSelectionMode && (
                            <TouchableOpacity onPress={() => setIsSelectionMode(true)}>
                                <Text style={{ color: theme.primary, fontWeight: '700' }}>Select Photos</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {monthlyGroups.map((group, gIdx) => (
                        <View key={group.name} style={styles.monthGroup}>
                            <View style={styles.monthHeader}>
                                <Text style={[styles.monthTitle, { color: theme.text }]}>{group.name}</Text>
                                <Text style={[styles.monthProgress, { color: theme.primary }]}>{group.snaps.length} Photos</Text>
                            </View>
                            <View style={styles.grid}>
                                {group.snaps.map((snap, index) => {
                                    const isSelected = selectedIds.includes(snap.id);
                                    return (
                                        <View key={snap.id} style={[styles.cardWrapper, { width: cardWidth }]}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.card,
                                                    { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: theme.backgroundCard },
                                                    isSelected && { borderWidth: 2 }
                                                ]}
                                                activeOpacity={0.9}
                                                onLongPress={() => !isSelectionMode && handleDelete(snap.id, index)}
                                                onPress={() => handleSnapshotPress(snap)}
                                            >
                                                <Image source={{ uri: snap.imageUrl }} style={[styles.image, { height: cardWidth * 1.35 }]} resizeMode="cover" />

                                                {isSelectionMode && (
                                                    <View style={[styles.selectionOverlay, isSelected && { backgroundColor: theme.primary + '30' }]}>
                                                        <View style={[styles.checkCircle, { backgroundColor: isSelected ? theme.primary : 'rgba(0,0,0,0.3)' }]}>
                                                            {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                                                        </View>
                                                    </View>
                                                )}

                                                <View style={styles.cardFooter}>
                                                    <View>
                                                        <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                                                            {format(parseISO(snap.date), 'MMM d')}
                                                        </Text>
                                                        {snap.weight && <Text style={[styles.weightText, { color: theme.primary }]}>{snap.weight}kg</Text>}
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ))}

                    {snapshots.length === 0 && !loading && (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="image-off-outline" size={50} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No snapshots yet. Start capturing your progress!</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <TouchableOpacity
                style={[styles.floatingAddButton, { backgroundColor: theme.primary }]}
                onPress={handleAddSnapshot}
                activeOpacity={0.9}
                disabled={loading}
            >
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialCommunityIcons name="camera" size={22} color="#FFF" />}
                <Text style={styles.floatingButtonText}>{loading ? 'Uploading...' : 'Capture'}</Text>
            </TouchableOpacity>

            <Modal visible={!!editingSnapshot} transparent animationType="slide" onRequestClose={() => setEditingSnapshot(null)}>
                <View style={styles.modalOverlay}>
                    <BlurView intensity={30} style={styles.absoluteFill} />
                    <View style={[styles.modalContent, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Refine Data</Text>
                        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>BODY WEIGHT (KG)</Text>
                        <TextInput
                            style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                            value={editWeight}
                            onChangeText={setEditWeight}
                            keyboardType="numeric"
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.backgroundInput }]} onPress={() => setEditingSnapshot(null)}>
                                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.primary }]} onPress={handleSaveEdit}>
                                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Update</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    loadingOverlay: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 150,
    },
    absoluteFill: {
        ...StyleSheet.absoluteFillObject,
    },
    journeyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 16,
    },
    statBox: {
        flex: 1,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '900',
    },
    unit: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.5,
    },
    activeDaysValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    miniBadge: {
        padding: 4,
        borderRadius: 8,
    },
    selectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1.5,
    },
    selectionInfo: {
        flex: 1,
    },
    selectionTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    selectionSubtitle: {
        fontSize: 12,
        fontWeight: '600',
    },
    doneButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    doneText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: 12,
    },
    modeTabs: {
        flexDirection: 'row',
        padding: 3,
        borderRadius: 20,
        marginBottom: 24,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    modeTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 17,
    },
    modeTabActive: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    modeTabText: {
        fontSize: 12,
        fontWeight: '700',
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    sectionSub: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.7,
    },
    compareTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    compareTriggerText: {
        fontSize: 12,
        fontWeight: '700',
    },
    comparisonSliderWrapper: {
        position: 'relative',
    },
    tapToExitTop: {
        minHeight: 80,
    },
    tapToExitBottom: {
        flex: 1,
    },
    fullScreenOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    modalComparisonContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        padding: 16,
    },
    modalComparisonContent: {
        width: '100%',
    },
    tapOutsideAbove: {
        flex: 1,
        minHeight: 60,
        marginBottom: 8,
    },
    tapOutsideBelow: {
        flex: 1,
        minHeight: 60,
        marginTop: 8,
    },
    comparisonTools: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    toolBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    toolLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    historySection: {
        marginBottom: 32,
    },
    monthGroup: {
        marginBottom: 24,
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    monthProgress: {
        fontSize: 12,
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    cardWrapper: {
        flexShrink: 0,
    },
    card: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
    },
    selectionOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        padding: 10,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
    image: {
        width: '100%',
        // height set inline from cardWidth for responsiveness
        backgroundColor: '#f0f0f0',
    },
    cardFooter: {
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 11,
        fontWeight: '600',
    },
    weightText: {
        fontSize: 11,
        fontWeight: '800',
    },
    floatingAddButton: {
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 30,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    floatingButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        gap: 16,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 40,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        borderRadius: 30,
        padding: 24,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 24,
        textAlign: 'center',
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 8,
        letterSpacing: 1,
    },
    modalInput: {
        height: 54,
        borderRadius: 16,
        borderWidth: 1.5,
        paddingHorizontal: 18,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnText: {
        fontSize: 15,
        fontWeight: '900',
    },
});
