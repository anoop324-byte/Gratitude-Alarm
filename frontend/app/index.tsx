import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AppLogo from '../components/AppLogo';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

interface Alarm {
  id: string;
  time: string;
  hours: number;
  minutes: number;
  ampm: string;
  enabled: boolean;
  repeat: boolean; // true = daily, false = once
  notificationId?: string;
}

const STORAGE_KEY = 'gratitude_alarms';

export default function Index() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [manualHours, setManualHours] = useState('10');
  const [manualMinutes, setManualMinutes] = useState('00');
  const [manualAMPM, setManualAMPM] = useState<'AM' | 'PM'>('AM');
  const [repeatAlarm, setRepeatAlarm] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState(true);

  useEffect(() => {
    requestPermissions();
    loadAlarms();
    loadMasterSwitch();
    setupNotificationListener();
  }, []);

  const loadMasterSwitch = async () => {
    try {
      const stored = await AsyncStorage.getItem('master_enabled');
      if (stored !== null) {
        setMasterEnabled(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading master switch:', error);
    }
  };

  const handleMasterToggle = async () => {
    const newState = !masterEnabled;
    setMasterEnabled(newState);
    
    try {
      await AsyncStorage.setItem('master_enabled', JSON.stringify(newState));
      
      if (!newState) {
        // Master OFF - cancel all notifications
        for (const alarm of alarms) {
          if (alarm.notificationId) {
            try {
              await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
            } catch (error) {
              console.log('Could not cancel notification');
            }
          }
        }
      } else {
        // Master ON - reschedule all enabled alarms
        for (const alarm of alarms) {
          if (alarm.enabled) {
            try {
              const notificationId = await scheduleNotification(alarm);
              alarm.notificationId = notificationId;
            } catch (error) {
              console.log('Could not schedule notification');
            }
          }
        }
        await saveAlarms(alarms);
      }
    } catch (error) {
      console.error('Error toggling master switch:', error);
    }
  };

  const requestPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'This app needs notification permissions to trigger vibration alarms.',
        [{ text: 'OK' }]
      );
    }
  };

  const setupNotificationListener = () => {
    // Listen for notifications
    const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
      // Vibrate when notification is received
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Get alarm ID from notification
      const alarmId = notification.request.content.data.alarmId as string;
      
      // Disable the alarm after it fires
      if (alarmId) {
        await disableAlarmAfterFiring(alarmId);
      }
    });

    return () => subscription.remove();
  };

  const disableAlarmAfterFiring = async (alarmId: string) => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const loadedAlarms: Alarm[] = JSON.parse(stored);
        const updatedAlarms = loadedAlarms.map(alarm => {
          // Only disable non-repeating alarms
          if (alarm.id === alarmId && !alarm.repeat) {
            return { ...alarm, enabled: false };
          }
          return alarm;
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlarms));
        setAlarms(updatedAlarms);
      }
    } catch (error) {
      console.error('Error disabling alarm:', error);
    }
  };

  const loadAlarms = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const loadedAlarms: Alarm[] = JSON.parse(stored);
        setAlarms(loadedAlarms);
      }
    } catch (error) {
      console.error('Error loading alarms:', error);
    }
  };

  const saveAlarms = async (newAlarms: Alarm[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newAlarms));
      setAlarms(newAlarms);
    } catch (error) {
      console.error('Error saving alarms:', error);
    }
  };

  const formatTime = (hours: number, minutes: number, ampm: string) => {
    const h = hours.toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  };

  const convertTo24Hour = (hours: number, ampm: string): number => {
    if (ampm === 'AM') {
      return hours === 12 ? 0 : hours;
    } else {
      return hours === 12 ? 12 : hours + 12;
    }
  };

  const scheduleNotification = async (alarm: Alarm) => {
    const now = new Date();
    const hours24 = convertTo24Hour(alarm.hours, alarm.ampm);
    
    const scheduledTime = new Date();
    scheduledTime.setHours(hours24, alarm.minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const trigger = alarm.repeat
      ? {
          // Daily repeat at the same time
          hour: hours24,
          minute: alarm.minutes,
          repeats: true,
        }
      : {
          // One-time alarm
          date: scheduledTime,
        };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Gratitude Reminder',
        body: '',
        data: { alarmId: alarm.id },
        sound: null,
        vibrate: [0, 500],
      },
      trigger,
    });

    return notificationId;
  };

  const handleAddAlarm = async () => {
    try {
      // Use manual inputs for time
      const hours12 = parseInt(manualHours) || 10;
      const minutes = parseInt(manualMinutes) || 0;
      const ampm = manualAMPM;

      // Validate input
      if (hours12 < 1 || hours12 > 12) {
        Alert.alert('Invalid Time', 'Hours must be between 1 and 12');
        return;
      }
      if (minutes < 0 || minutes > 59) {
        Alert.alert('Invalid Time', 'Minutes must be between 0 and 59');
        return;
      }

      const newAlarm: Alarm = {
        id: Date.now().toString(),
        time: formatTime(hours12, minutes, ampm),
        hours: hours12,
        minutes,
        ampm,
        enabled: true,
        repeat: repeatAlarm,
      };

      try {
        const notificationId = await scheduleNotification(newAlarm);
        newAlarm.notificationId = notificationId;
      } catch (error) {
        console.log('Notification scheduling not available (web platform)');
        // On web, notifications don't work but we still save the alarm
      }

      const updatedAlarms = [...alarms, newAlarm].sort((a, b) => {
        const aTime = convertTo24Hour(a.hours, a.ampm) * 60 + a.minutes;
        const bTime = convertTo24Hour(b.hours, b.ampm) * 60 + b.minutes;
        return aTime - bTime;
      });

      await saveAlarms(updatedAlarms);
      setModalVisible(false);
      
      // Reset to current time and default repeat setting
      const now = new Date();
      setManualHours(String((now.getHours() % 12) || 12));
      setManualMinutes(String(now.getMinutes()).padStart(2, '0'));
      setManualAMPM(now.getHours() >= 12 ? 'PM' : 'AM');
      setRepeatAlarm(false);
    } catch (error) {
      console.error('Error adding alarm:', error);
      Alert.alert('Error', 'Failed to add alarm. Please try again.');
    }
  };

  const handleDeleteAlarm = async (alarm: Alarm) => {
    Alert.alert(
      'Delete Alarm',
      'Are you sure you want to delete this alarm?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (alarm.notificationId) {
                try {
                  await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
                } catch (error) {
                  console.log('Could not cancel notification (web platform)');
                }
              }
              const updatedAlarms = alarms.filter(a => a.id !== alarm.id);
              await saveAlarms(updatedAlarms);
            } catch (error) {
              console.error('Error deleting alarm:', error);
            }
          },
        },
      ]
    );
  };

  const handleToggleAlarm = async (alarm: Alarm) => {
    try {
      let updatedAlarm = { ...alarm, enabled: !alarm.enabled };

      if (updatedAlarm.enabled) {
        // Cancel old notification if exists
        if (alarm.notificationId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
          } catch (error) {
            console.log('Could not cancel notification (web platform)');
          }
        }
        // Schedule new notification
        try {
          const notificationId = await scheduleNotification(updatedAlarm);
          updatedAlarm.notificationId = notificationId;
        } catch (error) {
          console.log('Notification scheduling not available (web platform)');
        }
      } else {
        // Cancel notification
        if (alarm.notificationId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
          } catch (error) {
            console.log('Could not cancel notification (web platform)');
          }
        }
      }

      const updatedAlarms = alarms.map(a => (a.id === alarm.id ? updatedAlarm : a));
      await saveAlarms(updatedAlarms);
    } catch (error) {
      console.error('Error toggling alarm:', error);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setSelectedTime(selectedDate);
    }
  };

  const renderAlarmItem = ({ item }: { item: Alarm }) => (
    <View style={styles.alarmItem}>
      <View style={styles.alarmLeft}>
        <Text style={[styles.alarmTime, !item.enabled && styles.disabledText]}>
          {item.time}
        </Text>
        {item.repeat && (
          <Text style={styles.repeatBadge}>Daily</Text>
        )}
      </View>
      <View style={styles.alarmRight}>
        <TouchableOpacity
          style={[styles.toggle, item.enabled ? styles.toggleOn : styles.toggleOff]}
          onPress={() => handleToggleAlarm(item)}
        >
          <View style={[styles.toggleThumb, item.enabled && styles.toggleThumbOn]} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteAlarm(item)}
        >
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AppLogo size={56} showWave={true} color="#FFF" />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Gratitude Reminder</Text>
            <Text style={styles.headerSubtitle}>Silent vibration alarms</Text>
          </View>
        </View>
        
        <View style={styles.masterSwitchContainer}>
          <View style={styles.masterSwitchLabel}>
            <Ionicons 
              name={masterEnabled ? "power" : "power-outline"} 
              size={18} 
              color="#FFF" 
            />
            <Text style={styles.masterSwitchText}>
              {masterEnabled ? 'ON' : 'OFF'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.masterToggle, masterEnabled ? styles.masterToggleOn : styles.masterToggleOff]}
            onPress={handleMasterToggle}
          >
            <View style={[styles.masterToggleThumb, masterEnabled && styles.masterToggleThumbOn]} />
          </TouchableOpacity>
        </View>
      </View>

      {alarms.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <AppLogo size={80} showWave={true} color="#0A7EA4" />
          </View>
          <Text style={styles.emptyText}>No alarms yet</Text>
          <Text style={styles.emptySubtext}>Tap the + button below to create your first reminder</Text>
        </View>
      ) : (
        <FlatList
          data={alarms}
          renderItem={renderAlarmItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.alarmList}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Alarm</Text>
            
            <View style={styles.timeInputContainer}>
              <View style={styles.timeInputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Hour</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={manualHours}
                    onChangeText={(text) => {
                      const num = text.replace(/[^0-9]/g, '');
                      if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 12)) {
                        setManualHours(num);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="10"
                    placeholderTextColor="#666"
                  />
                </View>
                
                <Text style={styles.timeSeparator}>:</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Minute</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={manualMinutes}
                    onChangeText={(text) => {
                      const num = text.replace(/[^0-9]/g, '');
                      if (num === '' || (parseInt(num) >= 0 && parseInt(num) <= 59)) {
                        setManualMinutes(num.padStart(2, '0'));
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="00"
                    placeholderTextColor="#666"
                  />
                </View>
                
                <View style={styles.ampmContainer}>
                  <TouchableOpacity
                    style={[styles.ampmButton, manualAMPM === 'AM' && styles.ampmButtonActive]}
                    onPress={() => setManualAMPM('AM')}
                  >
                    <Text style={[styles.ampmText, manualAMPM === 'AM' && styles.ampmTextActive]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmButton, manualAMPM === 'PM' && styles.ampmButtonActive]}
                    onPress={() => setManualAMPM('PM')}
                  >
                    <Text style={[styles.ampmText, manualAMPM === 'PM' && styles.ampmTextActive]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.repeatContainer}>
              <Text style={styles.repeatLabel}>Repeat</Text>
              <View style={styles.repeatOptions}>
                <TouchableOpacity
                  style={[styles.repeatButton, !repeatAlarm && styles.repeatButtonActive]}
                  onPress={() => setRepeatAlarm(false)}
                >
                  <Text style={[styles.repeatButtonText, !repeatAlarm && styles.repeatButtonTextActive]}>
                    Once
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.repeatButton, repeatAlarm && styles.repeatButtonActive]}
                  onPress={() => setRepeatAlarm(true)}
                >
                  <Text style={[styles.repeatButtonText, repeatAlarm && styles.repeatButtonTextActive]}>
                    Daily
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  const now = new Date();
                  setManualHours(String((now.getHours() % 12) || 12));
                  setManualMinutes(String(now.getMinutes()).padStart(2, '0'));
                  setManualAMPM(now.getHours() >= 12 ? 'PM' : 'AM');
                }}
                testID="cancel-button"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={handleAddAlarm}
                testID="add-alarm-button"
              >
                <Text style={styles.addButtonText}>Add Alarm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#0A7EA4',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  masterSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  masterSwitchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masterSwitchText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  masterToggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  masterToggleOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  masterToggleOn: {
    backgroundColor: '#FFF',
  },
  masterToggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0A7EA4',
  },
  masterToggleThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#0A7EA4',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#5F6368',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9AA0A6',
    textAlign: 'center',
  },
  alarmList: {
    padding: 20,
  },
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0A7EA4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  alarmLeft: {
    flex: 1,
  },
  alarmTime: {
    fontSize: 32,
    fontWeight: '600',
    color: '#202124',
    letterSpacing: -0.5,
  },
  repeatBadge: {
    fontSize: 12,
    color: '#0A7EA4',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  disabledText: {
    color: '#DADCE0',
  },
  alarmRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOff: {
    backgroundColor: '#DADCE0',
  },
  toggleOn: {
    backgroundColor: '#0A7EA4',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0A7EA4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0A7EA4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 24,
    textAlign: 'center',
  },
  timeInputContainer: {
    marginBottom: 24,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    width: 72,
    height: 64,
    textAlign: 'center',
    fontSize: 32,
    color: '#202124',
    fontWeight: '600',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSeparator: {
    fontSize: 40,
    color: '#5F6368',
    fontWeight: '300',
    marginTop: 20,
  },
  ampmContainer: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 4,
  },
  ampmButton: {
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 52,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ampmButtonActive: {
    backgroundColor: '#E8F4F8',
    borderColor: '#0A7EA4',
  },
  ampmText: {
    color: '#5F6368',
    fontSize: 14,
    fontWeight: '700',
  },
  ampmTextActive: {
    color: '#0A7EA4',
  },
  repeatContainer: {
    marginBottom: 28,
  },
  repeatLabel: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repeatOptions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  repeatButton: {
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  repeatButtonActive: {
    backgroundColor: '#E8F4F8',
    borderColor: '#0A7EA4',
  },
  repeatButtonText: {
    color: '#5F6368',
    fontSize: 15,
    fontWeight: '700',
  },
  repeatButtonTextActive: {
    color: '#0A7EA4',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F7FA',
  },
  cancelButtonText: {
    color: '#5F6368',
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#0A7EA4',
    elevation: 2,
    shadowColor: '#0A7EA4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
