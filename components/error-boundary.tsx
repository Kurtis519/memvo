import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type ErrorBoundaryVariant = 'screen' | 'inline';

type MemvoErrorBoundaryProps = {
  children: React.ReactNode;
  scope: string;
  title?: string;
  body?: string;
  variant?: ErrorBoundaryVariant;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
};

type MemvoErrorBoundaryState = {
  error: Error | null;
};

export class MemvoErrorBoundary extends React.Component<MemvoErrorBoundaryProps, MemvoErrorBoundaryState> {
  state: MemvoErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): MemvoErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[Memvo ${this.props.scope}]`, error, errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { body, children, scope, title, variant = 'screen' } = this.props;
    const { error } = this.state;

    if (!error) {
      return children;
    }

    const resolvedTitle = title ?? 'Memvo hit an unexpected error';
    const resolvedBody = body ?? 'Please close and reopen the app. The error details below will help diagnose what failed.';

    return (
      <View style={variant === 'inline' ? styles.inlineShell : styles.screenShell}>
        <View style={variant === 'inline' ? styles.inlineCard : styles.screenCard}>
          <Text style={styles.eyebrow}>Memvo</Text>
          <Text style={styles.title}>{resolvedTitle}</Text>
          <Text style={styles.body}>{resolvedBody}</Text>
          <Text style={styles.scopeLabel}>Scope</Text>
          <Text style={styles.scopeValue}>{scope}</Text>
          <Text style={styles.scopeLabel}>Error</Text>
          <Text style={styles.errorText}>{error.message || String(error)}</Text>
          <Pressable accessibilityRole="button" onPress={this.handleReset} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  inlineShell: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  screenCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 10,
  },
  inlineCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F3CFCF',
    backgroundColor: '#FFF7F7',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
  },
  eyebrow: {
    color: '#0F6E56',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1A1A1A',
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: '#555555',
    fontSize: 14,
    lineHeight: 22,
  },
  scopeLabel: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scopeValue: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#8A1F1F',
    fontSize: 13,
    lineHeight: 20,
  },
  resetButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#0F6E56',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
