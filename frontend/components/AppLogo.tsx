import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

interface AppLogoProps {
  size?: number;
  showWave?: boolean;
  color?: string;
}

export default function AppLogo({ size = 100, showWave = true, color = '#0A7EA4' }: AppLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Background Circle */}
        <Circle cx="50" cy="50" r="45" fill={color} opacity="0.15" />
        <Circle cx="50" cy="50" r="42" fill="white" />
        <Circle cx="50" cy="50" r="38" fill={color} />
        
        {/* Clock Face */}
        <Circle cx="50" cy="50" r="32" fill="white" />
        
        {/* Clock Center Dot */}
        <Circle cx="50" cy="50" r="3" fill={color} />
        
        {/* Hour Hand (pointing to 10) */}
        <Path
          d="M 50 50 L 50 30"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Minute Hand (pointing to 2) */}
        <Path
          d="M 50 50 L 65 50"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        
        {showWave && (
          <>
            {/* Vibration Wave Lines */}
            <Path
              d="M 72 35 Q 75 32 78 35"
              stroke={color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.8"
            />
            <Path
              d="M 75 40 Q 80 37 85 40"
              stroke={color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
            <Path
              d="M 22 35 Q 25 32 28 35"
              stroke={color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.8"
            />
            <Path
              d="M 15 40 Q 20 37 25 40"
              stroke={color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
          </>
        )}
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
