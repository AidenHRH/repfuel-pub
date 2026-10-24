import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { friendlyNumber } from '@/domain/format';
import { pieceFromPack, readPieceWeight } from '@/domain/measures';
import { spacing } from '@/theme/tokens';

type Props = {
  visible: boolean;
  /** The whole pack in g or ml, when known: then "How many in the pack?" works it out. */
  packSize: number | null;
  unit: 'g' | 'ml';
  onClose: () => void;
  onSave: (grams: number, label: string) => void;
};

/** Asked once per food: what one piece is called and how much it weighs (or how many are in the pack). */
export function PieceSheet({ visible, packSize, unit, onClose, onSave }: Props) {
  const [label, setLabel] = useState('piece');
  const [by, setBy] = useState<'weight' | 'count'>(packSize ? 'count' : 'weight');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const n = readPieceWeight(text);
    if (n === null) {
      setError(by === 'weight' ? 'Enter a weight above 0' : 'Enter how many, above 0');
      return;
    }
    const grams = by === 'count' && packSize ? pieceFromPack(packSize, n) : n;
    onSave(Math.round(grams * 100) / 100, label.trim() || 'piece');
  };

  const per = by === 'count' && packSize ? readPieceWeight(text) : null;
  return (
    <Sheet visible={visible} title="By the piece" onClose={onClose}>
      <TextField label="One is called" value={label} onChangeText={setLabel} placeholder="piece" />
      {packSize ? (
        <Segmented
          accessibilityLabel="I know"
          value={by}
          onChange={(v) => {
            setBy(v);
            setError(null);
          }}
          options={[
            { value: 'count', label: 'How many in the pack?' },
            { value: 'weight', label: 'How much one weighs' },
          ]}
        />
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <TextField
          label={by === 'count' ? `How many in the ${friendlyNumber(packSize ?? 0)} ${unit} pack?` : 'How much does one weigh?'}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          keyboardType="decimal-pad"
          suffix={by === 'weight' ? unit : undefined}
          error={error ?? undefined}
          autoFocus
        />
        {per && packSize ? (
          <Text variant="caption" color="text2" numeric>
            {`One is about ${friendlyNumber(Math.round(pieceFromPack(packSize, per) * 10) / 10)} ${unit}`}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color="text2">
        Asked once: RepFuel remembers it for this food.
      </Text>
      <Button label="Save" onPress={save} />
    </Sheet>
  );
}
