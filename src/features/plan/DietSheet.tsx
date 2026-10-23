import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { DIET_STYLE_LABELS, type DietPrefs } from '@/domain/diet';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const STYLES = Object.keys(DIET_STYLE_LABELS) as DietPrefs['style'][];

/** How the owner eats, for meal plans. Saving re-plans the week. */
export function DietSheet({
  visible,
  prefs,
  onClose,
  onSave,
}: {
  visible: boolean;
  prefs: DietPrefs;
  onClose: () => void;
  onSave: (prefs: DietPrefs) => void;
}) {
  const { colors } = useTheme();
  // Starts from the saved choices; the parent remounts it (key) each time it opens.
  const [draft, setDraft] = useState(prefs);

  const toggle = (key: 'dairyFree' | 'glutenFree' | 'useMyMeals', label: string) => (
    <ListRow label={label}>
      <Switch
        accessibilityLabel={label}
        value={draft[key]}
        onValueChange={(value) => setDraft((d) => ({ ...d, [key]: value }))}
        trackColor={{ true: colors.pro, false: colors.well }}
        thumbColor="#FFFFFF"
      />
    </ListRow>
  );

  return (
    <Sheet visible={visible} title="Your diet" onClose={onClose}>
      <ListGroup title="I eat">
        {STYLES.map((style) => {
          const selected = draft.style === style;
          return (
            <Pressable
              key={style}
              accessibilityRole="radio"
              accessibilityLabel={DIET_STYLE_LABELS[style]}
              accessibilityState={{ selected }}
              onPress={() => setDraft((d) => ({ ...d, style }))}
              style={({ pressed }) => ({
                minHeight: 50,
                paddingHorizontal: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: pressed ? colors.well : 'transparent',
              })}>
              <Text>{DIET_STYLE_LABELS[style]}</Text>
              {selected ? (
                <Text color="pro" variant="headline">
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ListGroup>
      <ListGroup footer="Your own meals are used as they are: RepFuel can only check the everyday foods it knows.">
        {draft.style === 'vegan' ? null : toggle('dairyFree', 'Dairy-free')}
        {toggle('glutenFree', 'Gluten-free')}
        {toggle('useMyMeals', 'Include my saved meals')}
      </ListGroup>
      <View>
        <Button label="Save and re-plan" onPress={() => onSave(draft)} />
      </View>
    </Sheet>
  );
}
