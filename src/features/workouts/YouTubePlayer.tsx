import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { embedUrl } from '@/domain/howTo';
import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';

/** A YouTube video playing inside RepFuel (the privacy-enhanced embed), 16:9, with full screen allowed. */
export function YouTubePlayer({ videoId }: { videoId: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ aspectRatio: 16 / 9, borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.well }}>
      <WebView
        accessibilityLabel="Video"
        source={{ uri: embedUrl(videoId) }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
