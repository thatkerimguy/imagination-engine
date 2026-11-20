import { Alert } from 'react-native';

/** Native confirmation dialog. Resolves true when the destructive action is chosen. */
export function confirmAction(
  title: string,
  message: string,
  actionLabel: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: actionLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
