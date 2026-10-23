import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

type Props = {
  title: string;
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
};

export function SectionHeader({ title, action }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Button variant="plain" label={action.label} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} />
      ) : null}
    </View>
  );
}
