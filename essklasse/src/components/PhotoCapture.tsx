import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const THUMB = (width - 48 - 12 * 2) / 3;

interface Props {
  uris: string[];
  onChange: (uris: string[]) => void;
}

export function PhotoCapture({ uris, onChange }: Props) {
  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Kamera-Zugriff', 'Bitte erlaube den Kamerazugriff in den Einstellungen.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      onChange([...uris, result.assets[0].uri]);
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Fotobibliothek', 'Bitte erlaube den Zugriff auf die Fotobibliothek.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      onChange([...uris, ...newUris]);
    }
  }

  function removePhoto(uri: string) {
    Alert.alert('Foto entfernen', 'Dieses Foto wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => onChange(uris.filter((u) => u !== uri)) },
    ]);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Belegfotos</Text>

      {/* Primary camera button */}
      <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto} activeOpacity={0.8}>
        <Ionicons name="camera" size={36} color="#fff" />
        <Text style={styles.cameraBtnText}>Foto aufnehmen</Text>
        <Text style={styles.cameraBtnSub}>Beleg fotografieren</Text>
      </TouchableOpacity>

      {/* Secondary: pick from library */}
      <TouchableOpacity style={styles.libraryBtn} onPress={pickFromLibrary} activeOpacity={0.8}>
        <Ionicons name="images-outline" size={18} color="#a8dadc" />
        <Text style={styles.libraryBtnText}>Aus Fotobibliothek wählen</Text>
      </TouchableOpacity>

      {/* Thumbnails */}
      {uris.length > 0 && (
        <View style={styles.thumbRow}>
          {uris.map((uri) => (
            <TouchableOpacity
              key={uri}
              onLongPress={() => removePhoto(uri)}
              style={styles.thumbWrap}
              activeOpacity={0.85}
            >
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(uri)}>
                <Ionicons name="close-circle" size={20} color="#e94560" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {uris.length === 0 && (
        <Text style={styles.hint}>Noch keine Fotos. Tippe auf „Foto aufnehmen" um den Beleg zu fotografieren.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  label: { color: '#b0b3b8', fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  cameraBtn: {
    backgroundColor: '#e94560',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 22,
    shadowColor: '#e94560',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cameraBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 },
  cameraBtnSub:  { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3b3c',
    gap: 8,
  },
  libraryBtnText: { color: '#a8dadc', fontSize: 14, fontWeight: '600' },

  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8 },
  thumbWrap: { position: 'relative', width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: '#16213e' },
  removeBtn: { position: 'absolute', top: -6, right: -6 },

  hint: { color: '#b0b3b8', fontSize: 13, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
});
