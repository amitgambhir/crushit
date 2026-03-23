import React from 'react';
import { Text, TextStyle } from 'react-native';

interface EmojiProps {
  children: string;
  size?: number;
  style?: TextStyle;
}

// Wrapper that prevents custom fontFamily from breaking emoji rendering.
// Custom fonts (Nunito/Inter) don't contain emoji glyphs — explicitly
// unsetting fontFamily lets iOS fall back to the system emoji font.
export function Emoji({ children, size = 16, style }: EmojiProps) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: undefined,
          fontSize: size,
          fontStyle: 'normal',
          fontWeight: '400',
          textTransform: 'none',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
