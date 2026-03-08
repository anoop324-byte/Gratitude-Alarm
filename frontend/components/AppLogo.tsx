import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface AppLogoProps {
  size?: number;
}

export default function AppLogo({ size = 100 }: AppLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer thin black circle */}
        <Circle 
          cx="50" 
          cy="50" 
          r="48" 
          fill="white"
          stroke="black"
          strokeWidth="2"
        />
        
        {/* Inner red dot */}
        <Circle 
          cx="50" 
          cy="50" 
          r="12" 
          fill="#FF3B30"
        />
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
