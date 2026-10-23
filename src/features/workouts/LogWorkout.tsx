import { useState } from 'react';

import { Segmented } from '@/components/Segmented';
import { TourTarget } from '@/features/tour/TourTarget';

import { ClassEditor } from './ClassEditor';
import { LiftEditor } from './LiftEditor';

type Mode = 'exercise' | 'class';

/** Log workout: an exercise (sets) or a class (Hyrox, spin …), switched at the top. */
export function LogWorkout({ from, initialMode = 'exercise' }: { from: 'today' | 'workouts'; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const switcher = (
    <TourTarget id="log-workout-class">
      <Segmented
        accessibilityLabel="What did you do"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'exercise', label: 'Exercise' },
          { value: 'class', label: 'Class' },
        ]}
      />
    </TourTarget>
  );
  return mode === 'exercise' ? <LiftEditor from={from} switcher={switcher} /> : <ClassEditor from={from} switcher={switcher} />;
}
