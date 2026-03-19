import React from 'react';
import { Alert } from 'react-native';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: any) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: any) {
        Alert.alert('App Error', error.message);
    }

    render() {
        if (this.state.error) {
            // Optionally render fallback UI
            return null;
        }
        return this.props.children;
    }
}
