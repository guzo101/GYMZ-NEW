import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function ShoppingList() {
    const [items, setItems] = useState([
        { id: 1, name: 'Oats (1kg pack)', checked: true },
        { id: 2, name: 'Chicken Breast (500g)', checked: false },
        { id: 3, name: 'Greek Yogurt', checked: false },
        { id: 4, name: 'Mixed Berries', checked: false },
    ]);

    const toggleItem = (id: number) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, checked: !item.checked } : item
        ));
    };

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Shopping List</Text>
                <TouchableOpacity style={styles.generateBtn}>
                    <MaterialCommunityIcons name="magic-staff" size={14} color="#6B7280" />
                    <Text style={styles.generateBtnText}>Generate</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {items.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.item}
                        onPress={() => toggleItem(item.id)}
                    >
                        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                            {item.checked && <MaterialCommunityIcons name="check" size={14} color="#FFF" />}
                        </View>
                        <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                            {item.name}
                        </Text>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.footerItem}>
                    <Text style={styles.footerText}>View All Ingredients</Text>
                    <MaterialCommunityIcons name="chevron-down" size={16} color="#2A4B2A" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    generateBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    list: {
        padding: 16,
        paddingHorizontal: 24,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        borderStyle: 'dashed',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#2A4B2A',
        borderColor: '#2A4B2A',
    },
    itemText: {
        fontSize: 14,
        color: '#1F2937',
    },
    itemTextChecked: {
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingTop: 16,
        paddingBottom: 8,
    },
    footerText: {
        color: '#2A4B2A',
        fontWeight: '600',
        fontSize: 14,
    },
});
