import React from 'react';
import { View, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';

interface GymzLogoProps {
    style?: ViewStyle;
    imageStyle?: ImageStyle;
    size?: number;
}

export const GymzLogo: React.FC<GymzLogoProps> = ({ style, imageStyle, size = 150 }) => {
    return (
        <View style={[styles.container, style]}>
            <Image
                source={require('../assets/gymzLogo.png')}
                style={[
                    styles.logo,
                    { width: size, height: size },
                    imageStyle
                ]}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        // Default placeholder style if needed
    },
});
