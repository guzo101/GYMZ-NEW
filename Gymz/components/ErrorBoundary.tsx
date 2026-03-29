import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log the error to console for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.title}>⚠️ Something went wrong</Text>
                        <Text style={styles.message}>
                            The app encountered an unexpected error. Please try restarting.
                        </Text>

                        {this.state.error && (
                            <ScrollView style={styles.errorContainer}>
                                <Text style={styles.errorTitle}>Error Details:</Text>
                                <Text style={styles.errorText}>
                                    {typeof this.state.error?.message === 'string'
                                      ? this.state.error.message
                                      : String(this.state.error)}
                                </Text>

                                {this.state.errorInfo?.componentStack != null && (
                                    <>
                                        <Text style={styles.errorTitle}>Component Stack:</Text>
                                        <Text style={styles.errorText}>
                                            {String(this.state.errorInfo.componentStack)}
                                        </Text>
                                    </>
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        maxWidth: 500,
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 24,
    },
    errorContainer: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        maxHeight: 300,
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.9)',
        marginTop: 10,
        marginBottom: 5,
    },
    errorText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontFamily: 'monospace',
    },
    button: {
        backgroundColor: '#6366f1',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ErrorBoundary;
