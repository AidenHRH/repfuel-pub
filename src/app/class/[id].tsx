import { useLocalSearchParams } from 'expo-router';

import { ClassEditor } from '@/features/workouts/ClassEditor';

export default function EditClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClassEditor classId={id} />;
}
