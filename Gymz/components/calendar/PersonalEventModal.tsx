import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    Platform,
    Alert
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface PersonalEventModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSave: (event: { title: string, date: string, startTime: string, duration: string }) => void;
    initialDate?: Date;
}

export const PersonalEventModal: React.FC<PersonalEventModalProps> = ({
    isVisible,
    onClose,
    onSave,
    initialDate = new Date()
}) => {
    const { theme } = useTheme();
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(format(initialDate, 'yyyy-MM-dd'));
    const [startTime, setStartTime] = useState(format(new Date(), 'HH:mm'));
    const [duration, setDuration] = useState('60');

    const handleSave = () => {
        if (!title.trim()) {
            Alert.alert("Error", "Please enter a title");
            return;
        }
        onSave({ title, date, startTime, duration });
        setTitle('');
        onClose();
    };

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.backgroundCard }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text }]}>New Personal Event</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialCommunityIcons name="close" size={24} color={theme.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <Text style={[styles.label, { color: theme.textMuted }]}>TITLE</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]}
                            placeholder="e.g. My Workout"
                            placeholderTextColor={theme.textMuted + '80'}
                            value={title}
                            onChangeText={setTitle}
                        />

                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.textMuted }]}>DATE</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]}
                                    value={date}
                                    onChangeText={setDate}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>
                            <View style={{ width: 16 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.textMuted }]}>TIME</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]}
                                    value={startTime}
                                    onChangeText={setStartTime}
                                    placeholder="HH:MM"
                                />
                            </View>
                        </View>

                        <Text style={[styles.label, { color: theme.textMuted }]}>DURATION (MINS)</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderBottomColor: theme.border }]}
                            value={duration}
                            onChangeText={setDuration}
                            keyboardType="numeric"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: theme.primary }]}
                        onPress={handleSave}
                    >
                        <Text style={styles.saveButtonText}>Save Event</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    form: {
        gap: 20,
        marginBottom: 32,
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    row: {
        flexDirection: 'row',
    },
    saveButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
