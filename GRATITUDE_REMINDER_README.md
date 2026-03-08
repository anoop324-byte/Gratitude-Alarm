# Gratitude Reminder 🔔

A minimalist mobile alarm app that uses **silent vibration only** to remind you for gratitude moments throughout the day.

## ✨ Features

- **Single Vibration Pulse** - Alarms vibrate once when triggered (no sound, no repeating notifications)
- **Multiple Alarms** - Create as many reminders as you need
- **Simple Management** - Easy add, delete, and toggle on/off
- **12-Hour Format** - User-friendly time display with AM/PM
- **One-Time Alarms** - Alarms automatically disable after firing once
- **Local Storage** - All data stays on your device
- **Clean UI** - Material Design inspired with purple accent color
- **Background Support** - Alarms work even when app is closed

## 📱 Testing on Mobile Device

**IMPORTANT:** This app requires a physical mobile device to test core functionality (notifications, vibrations, background alarms). The web preview has limited functionality.

### Using Expo Go (Recommended for Testing)

1. **Install Expo Go** on your Android or iOS device:
   - Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Get the QR Code**:
   ```bash
   cd /app/frontend
   yarn start
   ```
   
3. **Scan the QR Code**:
   - Android: Use Expo Go app to scan
   - iOS: Use Camera app to scan (it will open in Expo Go)

4. **Grant Permissions**:
   - When prompted, allow notification permissions
   - This enables the vibration alarms to work in background

### Testing Checklist

- [ ] Add alarm with custom time
- [ ] Verify alarm appears in list with correct time
- [ ] Toggle alarm off and on
- [ ] Delete alarm with confirmation
- [ ] Add multiple alarms (verify sorting by time)
- [ ] Close app completely (swipe away)
- [ ] Wait for alarm time - should vibrate once
- [ ] Reopen app - alarm should be disabled after firing
- [ ] Test alarm persistence (add alarm, close app, reopen - alarm should still be there)

## 🎨 UI/UX Design

- **Dark Theme** - Easy on the eyes with #121212 background
- **Purple Accent** - #6200EA for primary actions
- **Material Design** - Follows modern mobile design patterns
- **Touch-Friendly** - Large touch targets (64px FAB button)
- **Empty State** - Helpful guidance when no alarms exist
- **Confirmation Dialogs** - Prevents accidental deletions

## 🛠️ Technical Stack

- **Frontend**: React Native with Expo
- **Routing**: expo-router (file-based routing)
- **Storage**: @react-native-async-storage/async-storage
- **Notifications**: expo-notifications
- **Vibration**: expo-haptics
- **Time Picker**: @react-native-community/datetimepicker

## 📂 Project Structure

```
/app
├── frontend/
│   ├── app/
│   │   └── index.tsx          # Main app screen (alarm list + add modal)
│   ├── app.json               # Expo configuration with permissions
│   └── package.json           # Dependencies
└── backend/                   # Not used (local storage only)
```

## 🔐 Permissions Required

### Android
- `VIBRATE` - To vibrate device when alarm triggers
- `POST_NOTIFICATIONS` - To schedule background alarms
- `SCHEDULE_EXACT_ALARM` - For precise alarm timing
- `USE_EXACT_ALARM` - Android 12+ exact alarm support
- `RECEIVE_BOOT_COMPLETED` - Reschedule alarms after device restart

### iOS
- `NSUserNotificationsUsageDescription` - "Trigger gratitude reminder vibrations"
- `UIBackgroundModes: remote-notification` - Background alarm support

## 🚀 Development

### Start Development Server
```bash
cd /app/frontend
yarn start
```

### Restart Expo Service
```bash
sudo supervisorctl restart expo
```

### View Logs
```bash
tail -f /var/log/supervisor/expo.err.log
```

## 📝 How It Works

1. **Adding Alarms**: 
   - Tap the purple + button
   - Select time using the time picker
   - Alarm is scheduled using expo-notifications
   - Stored locally with AsyncStorage

2. **Alarm Triggers**:
   - At scheduled time, notification fires (silent, no display)
   - expo-haptics triggers single vibration pulse
   - Alarm automatically disables itself
   - User can re-enable for next use

3. **Storage**:
   - All alarms stored in AsyncStorage under key 'gratitude_alarms'
   - Persists across app restarts
   - No server/backend required

4. **Background Operation**:
   - Uses native notification scheduling
   - Works even when app is closed
   - Requires notification permissions

## ⚠️ Known Limitations

- **Web Preview**: Core features (notifications, vibrations) don't work in web browser. Must test on actual device.
- **iOS Background**: iOS may delay notifications by a few seconds when app is in background (OS limitation)
- **Android Battery**: Some aggressive battery savers may prevent alarms. User needs to exempt app from battery optimization.
- **No Repeating**: Alarms fire once and disable. This is by design per requirements.

## 🎯 Future Enhancements (Optional)

- Custom vibration patterns (short/medium/long)
- Labels for each alarm (e.g., "Morning gratitude")
- Snooze option
- Daily repeat option
- Dark mode toggle
- Vibration test button
- Statistics (alarms completed)

## 📄 License

Private project - not for distribution.
