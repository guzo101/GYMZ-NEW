import React, { useState } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import { useCamera } from '../hooks/useCameraPermissions';
import { useScanFeedback } from '../hooks/useScanFeedback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { logSelfCheckInAttempt, checkIn, verifyGymCheckInBarcode, verifyMemberHasAccess } from '../services/attendanceService';
import { CheckInSuccessModal, CheckInSuccessData } from '../components/CheckInSuccessModal';

export default function EventQRCheckInScreen({ navigation }: any) {
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

        const dataStr = (typeof data === 'string' ? data : String(data || '')).trim();

        try {
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

            // ─── EVENT CHECK-IN: gymz_event_checkin:{event_id}:{secret} ───
            if (!dataStr.startsWith('gymz_event_checkin:')) {
                playScanError();
                await logSelfCheckInAttempt({ success: false, reason: 'Invalid QR code format' });
                Alert.alert(
                    'Wrong QR Code',
                    'Scan the gym QR (at the entrance) or event QR (at the event venue).',
                    [{ text: 'OK', onPress: () => setScanned(false) }]
                );
                return;
            }

            const [_, eventId, secret] = dataStr.split(':');

            // In a real scenario, we would verify the 'secret' via an RPC
            // For this implementation, we check if the user has a confirmed RSVP
            const { data: rsvp, error: rsvpError } = await (supabase as any)
                .from('event_rsvps')
                .select('*, events(title)')
                .eq('event_id', eventId)
                .eq('user_id', user?.id)
                .eq('status', 'confirmed')
                .maybeSingle();

            if (rsvpError) throw rsvpError;

            if (!rsvp) {
                playScanError();
                await logSelfCheckInAttempt({ success: false, reason: 'Need to sign up for event first', eventId });
                Alert.alert(
                    'Check-in Failed',
                    'You need to sign up for this event first before checking in.',
                    [{ text: 'OK', onPress: () => setScanned(false) }]
                );
                return;
            }

            // Mark as checked in (checked_in + check_in_time for audit)
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

            const accessCheck = await verifyMemberHasAccess(user!.id);
            setSuccessModal({
                type: 'event',
                message: `You have checked in to ${rsvp.events?.title || 'the event'}. Enjoy the event!`,
                membershipStatus: accessCheck.membershipStatus,
                renewalDueDate: accessCheck.renewalDueDate,
                daysRemaining: accessCheck.daysRemaining,
            });
        } catch (err: any) {
            console.error('[QRCheckIn] Error:', err);
            playScanError();
            const eventId = dataStr?.startsWith('gymz_event_checkin:') ? dataStr.split(':')[1] : undefined;
            await logSelfCheckInAttempt({ success: false, reason: err.message || 'Check-in failed', eventId }).catch(() => {});
            Alert.alert(
                'Error',
                err.message || 'Failed to process check-in. Please try again.',
                [{ text: 'OK', onPress: () => setScanned(false) }]
            );
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
            <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                <View style={styles.overlay}>
                    {/* Top Bar */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                            <MaterialCommunityIcons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Event Check-in</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Scanner UI */}
                    <View style={styles.scannerWrapper}>
                        <View style={styles.scanFrame}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                            {loading && <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />}
                        </View>
                        <Text style={styles.instructionText}>Scan the QR Code at the venue</Text>
                        <Text style={styles.subInstructionText}>Gym entrance or event venue</Text>
                    </View>

                    {/* Bottom Info */}
                    <View style={styles.bottomInfo}>
                        <View style={styles.infoBadge}>
                            <MaterialCommunityIcons name="shield-check" size={16} color="#4CAF50" />
                            <Text style={styles.infoBadgeText}>Secure Self Check-in</Text>
                        </View>
                    </View>
                </View>
            </CameraView>

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
    container: { flex: 1, backgroundColor: 'black' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
    errorText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    backButton: { backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    camera: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'space-between' },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 50, paddingHorizontal: 20,
    },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    scannerWrapper: { alignItems: 'center', justifyContent: 'center' },
    scanFrame: {
        width: 250, height: 250, position: 'relative',
        justifyContent: 'center', alignItems: 'center',
    },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#4CAF50', borderWidth: 4 },
    topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 20 },
    topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 20 },
    bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 20 },
    bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 20 },
    instructionText: { color: '#fff', fontSize: 16, marginTop: 40, fontWeight: '500', opacity: 0.9 },
    subInstructionText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8 },
    loader: { position: 'absolute' },
    bottomInfo: { paddingBottom: 60, alignItems: 'center' },
    infoBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(42,75,42,0.4)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    },
    infoBadgeText: { color: '#4CAF50', fontSize: 13, fontWeight: '700' },
});
