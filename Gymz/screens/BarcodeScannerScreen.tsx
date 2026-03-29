
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import { CameraView } from 'expo-camera';
import { useCamera } from '../hooks/useCameraPermissions';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { IconButton, ActivityIndicator } from 'react-native-paper';
import { useTheme } from '../hooks/useTheme';
import { useScanFeedback } from '../hooks/useScanFeedback';
import { OpenFoodFactsService, ScannedFoodItem } from '../services/OpenFoodFactsService';

export default function BarcodeScannerScreen() {
    const { theme } = useTheme();
    const { hasPermission, requestPermission, canAskAgain } = useCamera();
    const { playScanClick, playScanSuccess, playScanError } = useScanFeedback();
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        setLoading(true);
        playScanClick();

        try {
            const foodItem = await OpenFoodFactsService.getProductByBarcode(data);

            if (foodItem) {
                playScanSuccess();
                navigation.navigate('Nutrition', { scannedFoodItem: foodItem });
            } else {
                playScanError();
                Alert.alert(
                    'Product Not Found',
                    `Could not find food details for barcode: ${data}`,
                    [{ text: 'OK', onPress: () => setScanned(false) }]
                );
            }
        } catch (error) {
            playScanError();
            Alert.alert(
                'Error',
                'Failed to look up product. Please check your internet connection.',
                [{ text: 'OK', onPress: () => setScanned(false) }]
            );
        } finally {
            setLoading(false);
        }
    };

    if (hasPermission === null) {
        return <View style={[styles.container, { backgroundColor: theme.background }]} />;
    }
    if (hasPermission === false) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text, marginBottom: 20 }}>No access to camera</Text>

                {canAskAgain && (
                    <TouchableOpacity
                        onPress={() => requestPermission()}
                        style={{ backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginBottom: 15 }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Enable Camera</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={{ color: theme.primary }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {isFocused && (
                <CameraView
                    style={styles.camera}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
                    }}
                >
                    <View style={styles.overlay}>
                        <View style={styles.topOverlay}>
                            <Text style={styles.instructionText}>Scan a food barcode</Text>
                        </View>
                        <View style={styles.middleRow}>
                            <View style={styles.sideOverlay} />
                            <View style={styles.scanFrame}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>
                            <View style={styles.sideOverlay} />
                        </View>
                        <View style={styles.bottomOverlay}>
                            {loading && <ActivityIndicator size="large" color="#fff" style={styles.loader} />}
                            <IconButton
                                icon="close"
                                iconColor="#fff"
                                size={30}
                                style={styles.closeButton}
                                onPress={() => navigation.goBack()}
                            />
                        </View>
                    </View>
                </CameraView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    topOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    middleRow: {
        flexDirection: 'row',
        height: 250,
    },
    sideOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    scanFrame: {
        width: 250,
        height: 250,
        backgroundColor: 'transparent', // Clear scan area
        position: 'relative',
    },
    bottomOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    instructionText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    loader: {
        marginBottom: 20
    },
    // Corner markers for the scan frame
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: 'white',
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
});
