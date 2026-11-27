// Visual DNA & Book Style route (Novel Settings → Visual DNA).
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { DnaStudioScreen } from '../../../dna/DnaStudioScreen.tsx';

export default function VisualDnaRoute(): ReactNode {
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  return <DnaStudioScreen key={novelId} novelId={novelId} />;
}
