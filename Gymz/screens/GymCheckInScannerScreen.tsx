import React, { useState } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import { useCamera } from '../hooks/useCameraPermissions';
import { useScanFeedback } from '../hooks/useScanFeedback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { checkIn, verifyGymCheckInBarcode, verifyMemberHasAccess, logSelfCheckInAttempt } from '../services/attendanceService';
import { CheckInSuccessModal, CheckInSuccessData } from '../components/CheckInSuccessModal';

export default function GymCheckInScannerScreen({ navigation }: any) {
    const { user } = useAuth();
    const { hasPermission, requestPermission, canAskAgain } = useCamera();
    const { playScanClick, playScanSuccess, playScanError } = useScanFeedback();
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [successModal, setSuccessModal] = useState<CheckInSuccessData | null>(null);

    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanned || loading) return;
        setScanned(true);
        setLoading(true);
        playScanClick();

        try {
            const raw = data ?? '';
            const dataStr = (typeof raw === 'string' ? raw : String(raw)).trim();
            if (!dataStr) {
                throw new Error('Invalid scan. Please scan the QR code at the gym or event entrance.');
            }

            // ─── EVENT CHECK-IN: gymz_event_checkin:{event_id}:{secret} ───
            if (dataStr.startsWith('gymz_event_checkin:')) {
                const parts = dataStr.split(':');
                const eventId = parts[1];
                if (!eventId) {
                    playScanError();
                    await logSelfCheckInAttempt({ success: false, reason: 'Wrong event QR format', eventId });
                    Alert.alert('Invalid QR', 'Wrong event QR format. Scan the QR displayed at the event.', [{ text: 'OK', onPress: () => setScanned(false) }]);
                    return;
                }
                const { data: rsvp, error: rsvpError } = await (supabase as any)
                    .from('event_rsvps')
                    .select('*, events(title, gym_id)')
                    .eq('event_id', eventId)
                    .eq('user_id', user?.id)
                    .eq('status', 'confirmed')
                    .maybeSingle();
                if (rsvpError) throw rsvpError;
                if (!rsvp) {
                    playScanError();
                    await logSelfCheckInAttempt({ success: false, reason: 'Need to sign up for event first', eventId });
                    Alert.alert('Check-in Failed', 'You need to sign up for this event first.', [{ text: 'OK', onPress: () => setScanned(false) }]);
                    return;
                }
                const { error: updateError } = await (supabase as any)
                    .from('event_rsvps')
                    .update({
                        checked_in: true,
                        check_in_time: new Date().toISOString(),
                    })
                    .eq('id', rsvp.id);
                if (updateError) throw updateError;
                await logSelfCheckInAttempt({ success: true, reason: `Checked in to ${rsvp.events?.title || 'event'}`, eventId });
                playScanSuccess();
                setSuccessModal({
                    type: 'event',
                    message: `Checked in to ${rsvp.events?.title || 'the event'}.`,
                });
                return;
            }

            // ─── GYM CHECK-IN: gymz_gym_checkin:{gym_id}:{code} ───
            if (dataStr.startsWith('gymz_gym_checkin:')) {
                const verification = await verifyGymCheckInBarcode(dataStr);
                if (!verification.valid) {
                    playScanError();
                    await logSelfCheckInAttempt({ success: false, reason: verification.reason || 'Invalid barcode', gymId: verification.gymId });
                    Alert.alert(
                        'Invalid Barcode',
                        verification.reason || 'This gym barcode is not valid. Scan the current QR at the gym entrance.',
                        [{ text: 'OK', onPress: () => setScanned(false) }]
                    );
                    return;
                }

                // Verify member has gym OR event access before allowing check-in
                const accessCheck = await verifyMemberHasAccess(user!.id);
                if (!accessCheck.hasAccess) {
                    playScanError();
                    await logSelfCheckInAttempt({ success: false, reason: accessCheck.reason || 'No active access', gymId: verification.gymId });
                    Alert.alert(
                        'No Active Access',
                        accessCheck.reason || 'You need active gym membership or event sign-up to check in.',
                        [{ text: 'OK', onPress: () => setScanned(false) }]
                    );
                    return;
                }

                const result = await checkIn({ userId: user!.id, location: null, qrCode: dataStr });
                if (result.success) {
                    await logSelfCheckInAttempt({ success: true, reason: 'Checked in successfully', gymId: verification.gymId });
                    playScanSuccess();
                    setSuccessModal({
                        type: 'gym',
                        message: result.message,
                        membershipStatus: accessCheck.membershipStatus,
                        renewalDueDate: accessCheck.renewalDueDate,
                        daysRemaining: accessCheck.daysRemaining,
                    });
                } else {
                    playScanError();
                    await logSelfCheckInAttempt({ success: false, reason: result.message, gymId: verification.gymId });
                    Alert.alert('Check-in Failed', result.message, [{ text: 'OK', onPress: () => setScanned(false) }]);
                }
                return;
            }

            // Unknown format
            playScanError();
            await logSelfCheckInAttempt({ success: false, reason: 'Wrong QR code format' });
            Alert.alert(
                'Wrong QR Code',
                'Scan the gym barcode (at the entrance) or event QR (at the event venue).',
                [{ text: 'OK', onPress: () => setScanned(false) }]
            );
        } catch (err: any) {
            console.error('[CheckInScanner] Error:', err);
            playScanError();
            Alert.alert('Error', err.message || 'Failed to process check-in. Please try again.', [{ text: 'OK', onPress: () => setScanned(false) }]);
        } finally {
            setLoading(false);
        }
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0A120A', '#1B241B']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.errorContainer}>
                <LinearGradient colors={['#0A120A', '#1B241B']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <MaterialCommunityIcons name="camera-off" size={64} color="rgba(255,255,255,0.2)" />
                <Text style={styles.errorText}>Camera access denied</Text>

                {canAskAgain && (
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: '#2196F3', marginBottom: 10 }]}
                        onPress={() => requestPermission()}
                    >
                        <Text style={styles.backButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B']} style={StyleSheet.absoluteFill} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <MaterialCommunityIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Check In</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.scannerContainer}>
                <View style={styles.cameraWrapper}>
                    <CameraView
                        style={styles.camera}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    />
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                        {loading && <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />}
                    </View>
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.instructionText}>Scan gym or event QR code</Text>
                    <Text style={styles.subInstructionText}>Entrance or event venue</Text>
                </View>
            </View>

            <View style={styles.bottomInfo}>
                <View style={styles.infoBadge}>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#4CAF50" />
                    <Text style={styles.infoBadgeText}>Self Check-in Enabled</Text>
                </View>
            </View>

            <CheckInSuccessModal
                visible={!!successModal}
                onClose={() => {
                    setSuccessModal(null);
                    navigation.navigate('Attendance');
                }}
                data={successModal}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A120A' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
    errorText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    backButton: { backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 60, paddingHorizontal: 20,
    },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
    scannerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    cameraWrapper: {
        width: 300,
        height: 300,
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#000',
    },
    camera: { flex: 1 },
    scanFrame: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#F1C93B', borderWidth: 4 },
    topLeft: { top: 20, left: 20, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 15 },
    topRight: { top: 20, right: 20, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 15 },
    bottomLeft: { bottom: 20, left: 20, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 15 },
    bottomRight: { bottom: 20, right: 20, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 15 },
    textContainer: { alignItems: 'center', marginTop: 30 },
    instructionText: { color: '#fff', fontSize: 18, fontWeight: '700', opacity: 0.9 },
    subInstructionText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 },
    bottomInfo: { paddingBottom: 60, alignItems: 'center' },
    infoBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    },
    infoBadgeText: { color: '#F1C93B', fontSize: 13, fontWeight: '700' },
    loader: { position: 'absolute' },
});
