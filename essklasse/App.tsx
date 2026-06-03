import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BottomNav, TabKey } from './src/components/BottomNav';
import { TodayScreen } from './src/screens/TodayScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { NewBelegScreen } from './src/screens/NewBelegScreen';
import { BelegDetailScreen } from './src/screens/BelegDetailScreen';
import { Bewirtungsbeleg } from './src/types';
import { syncPendingBelege } from './src/services/syncService';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [showNew, setShowNew] = useState(false);
  const [detailBeleg, setDetailBeleg] = useState<Bewirtungsbeleg | null>(null);

  // Attempt background sync on app start
  useEffect(() => {
    syncPendingBelege().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
        <View style={styles.root}>

          {/* Main screens */}
          {activeTab === 'today' && (
            <TodayScreen onOpenBeleg={setDetailBeleg} />
          )}
          {activeTab === 'calendar' && (
            <CalendarScreen onOpenBeleg={setDetailBeleg} />
          )}

          {/* Bottom navigation (always visible) */}
          <BottomNav
            activeTab={activeTab}
            onTab={setActiveTab}
            onNew={() => setShowNew(true)}
          />

          {/* New Beleg Modal (full screen) */}
          <Modal
            visible={showNew}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setShowNew(false)}
          >
            <NewBelegScreen
              onClose={() => setShowNew(false)}
              onSuccess={() => {}}
            />
          </Modal>

          {/* Detail Modal */}
          <Modal
            visible={!!detailBeleg}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setDetailBeleg(null)}
          >
            {detailBeleg && (
              <BelegDetailScreen
                beleg={detailBeleg}
                onClose={() => setDetailBeleg(null)}
              />
            )}
          </Modal>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
});
