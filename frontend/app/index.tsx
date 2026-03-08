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
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

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
  notificationId?: string;
}

const STORAGE_KEY = 'gratitude_alarms';

export default function Index() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    requestPermissions();
    loadAlarms();
    setupNotificationListener();
  }, []);

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
        const updatedAlarms = loadedAlarms.map(alarm =>
          alarm.id === alarmId ? { ...alarm, enabled: false } : alarm
        );
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

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Gratitude Reminder',
        body: '',
        data: { alarmId: alarm.id },
        sound: null,
        vibrate: [0, 500],
      },
      trigger: {
        date: scheduledTime,
      },
    });

    return notificationId;
  };

  const handleAddAlarm = async () => {
    try {
      const hours = selectedTime.getHours();
      const minutes = selectedTime.getMinutes();
      
      // Convert to 12-hour format
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;

      const newAlarm: Alarm = {
        id: Date.now().toString(),
        time: formatTime(hours12, minutes, ampm),
        hours: hours12,
        minutes,
        ampm,
        enabled: true,
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
      setSelectedTime(new Date());
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
          <Ionicons name="notifications-outline" size={28} color="#6200EA" />
        </View>
        <Text style={styles.headerTitle}>Gratitude Reminder</Text>
      </View>

      {alarms.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="alarm-outline" size={60} color="#444" />
          <Text style={styles.emptyText}>No alarms</Text>
          <Text style={styles.emptySubtext}>Tap + to add</Text>
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
            
            <TouchableOpacity
              style={styles.timeDisplay}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={32} color="#6200EA" />
              <Text style={styles.timeText}>
                {selectedTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </TouchableOpacity>

            {(showTimePicker || Platform.OS === 'ios') && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
                style={styles.timePicker}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setShowTimePicker(false);
                  setSelectedTime(new Date());
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
    backgroundColor: '#000',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },
  alarmList: {
    padding: 16,
  },
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  alarmLeft: {
    flex: 1,
  },
  alarmTime: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFF',
  },
  disabledText: {
    color: '#444',
  },
  alarmRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOff: {
    backgroundColor: '#2A2A2A',
  },
  toggleOn: {
    backgroundColor: '#6200EA',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  deleteButton: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6200EA',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFF',
  },
  timePicker: {
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2A2A2A',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#6200EA',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
