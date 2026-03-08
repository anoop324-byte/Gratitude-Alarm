import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

interface AppLogoProps {
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function AppLogo({ 
  size = 100, 
  color = '#0A7EA4',
  backgroundColor = 'white'
}: AppLogoProps) {
  const fontSize = size * 0.6;
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Background Circle */}
        <Circle cx="50" cy="50" r="48" fill={color} />
        <Circle cx="50" cy="50" r="44" fill={backgroundColor} />
        <Circle cx="50" cy="50" r="42" fill={color} />
        
        {/* Letter G */}
        <SvgText
          x="50"
          y="50"
          fontSize={fontSize}
          fontWeight="700"
          fill={backgroundColor}
          textAnchor="middle"
          alignmentBaseline="central"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          G
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
