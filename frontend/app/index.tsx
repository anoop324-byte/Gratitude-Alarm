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

    const notificationId = await scheduleNotification(newAlarm);
    newAlarm.notificationId = notificationId;

    const updatedAlarms = [...alarms, newAlarm].sort((a, b) => {
      const aTime = convertTo24Hour(a.hours, a.ampm) * 60 + a.minutes;
      const bTime = convertTo24Hour(b.hours, b.ampm) * 60 + b.minutes;
      return aTime - bTime;
    });

    await saveAlarms(updatedAlarms);
    setModalVisible(false);
    setSelectedTime(new Date());
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
            if (alarm.notificationId) {
              await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
            }
            const updatedAlarms = alarms.filter(a => a.id !== alarm.id);
            await saveAlarms(updatedAlarms);
          },
        },
      ]
    );
  };

  const handleToggleAlarm = async (alarm: Alarm) => {
    let updatedAlarm = { ...alarm, enabled: !alarm.enabled };

    if (updatedAlarm.enabled) {
      // Cancel old notification if exists
      if (alarm.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
      }
      // Schedule new notification
      const notificationId = await scheduleNotification(updatedAlarm);
      updatedAlarm.notificationId = notificationId;
    } else {
      // Cancel notification
      if (alarm.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
      }
    }

    const updatedAlarms = alarms.map(a => (a.id === alarm.id ? updatedAlarm : a));
    await saveAlarms(updatedAlarms);
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
        <Text style={styles.headerTitle}>Gratitude Reminder</Text>
        <Text style={styles.headerSubtitle}>Silent vibration alarms</Text>
      </View>

      {alarms.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="alarm-outline" size={80} color="#666" />
          <Text style={styles.emptyText}>No alarms set</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first reminder</Text>
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
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={handleAddAlarm}
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
    backgroundColor: '#121212',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#1E1E1E',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    color: '#999',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  alarmList: {
    padding: 16,
  },
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  alarmLeft: {
    flex: 1,
  },
  alarmTime: {
    fontSize: 36,
    fontWeight: '300',
    color: '#FFF',
    letterSpacing: 1,
  },
  disabledText: {
    color: '#666',
  },
  alarmRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOff: {
    backgroundColor: '#333',
  },
  toggleOn: {
    backgroundColor: '#6200EA',
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  deleteButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6200EA',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    gap: 16,
  },
  timeText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFF',
    letterSpacing: 1,
  },
  timePicker: {
    marginBottom: 24,
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
    backgroundColor: '#333',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#6200EA',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
