import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Point this to your backend that runs Mastra (e.g. https://your-api.com)
const ANALYZE_IMAGE_API_URL = process.env.EXPO_PUBLIC_ANALYZE_IMAGE_API_URL ?? 'https://young-rapping-australia.mastra.cloud/api/agents/plate-reader-agent/generate';

export default function HomeScreen() {
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTakePicture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      alert('Camera permission is required to take a picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      setCapturedImageUri(result.assets[0].uri);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!capturedImageUri) return;

    console.log('Analyze clicked – image URI:', capturedImageUri);

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        capturedImageUri,
        [],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      if (!manipulated.base64) {
        throw new Error('Failed to encode image to base64 after compression.');
      }

      const mimeType = 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${manipulated.base64}`;

      const body = {
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'image' as const, image: dataUrl, mimeType: 'image/jpeg' },
              { type: 'text' as const, text: 'Return a json object with the list of : vegetables, meats, beans, fruits, others. Use the image to identify the items.' },
            ],
          },
        ],
      };

      const res = await fetch(ANALYZE_IMAGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const raw = await res.text();

      if (!res.ok) {
        throw new Error(raw || `HTTP ${res.status}`);
      }

      if (!raw || !raw.trim()) {
        throw new Error(
          'Server returned an empty response. The API may expect a different request format or return a streaming response.',
        );
      }

      let data: { description?: string; text?: string; [key: string]: unknown };
      try {
        data = JSON.parse(raw) as { description?: string; text?: string; [key: string]: unknown };
      } catch {
        throw new Error(
          `Server did not return valid JSON. Response: ${raw.slice(0, 100)}${raw.length > 100 ? '…' : ''}`,
        );
      }

      const result = data?.result as { text?: string } | undefined;
      const text =
        typeof data?.text === 'string'
          ? data.text
          : typeof data?.description === 'string'
            ? data.description
            : typeof result?.text === 'string'
              ? result.text
              : null;

      setAnalysisResult(text ?? 'No description returned.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Analysis failed.';
      Alert.alert('Analysis failed', message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Take a picture</ThemedText>
        <Button title="Take picture" onPress={handleTakePicture} />
        {capturedImageUri && (
          <>
            <Image source={{ uri: capturedImageUri }} style={styles.capturedImage} />
            <Button
              title={isAnalyzing ? 'Analyzing…' : 'Analyze'}
              onPress={handleAnalyze}
              disabled={isAnalyzing}
            />
            {isAnalyzing && <ActivityIndicator style={styles.loader} />}
            {analysisResult != null && !isAnalyzing && (
              <ThemedView style={styles.resultBox}>
                <ThemedText type="defaultSemiBold">Description</ThemedText>
                <ThemedText>{analysisResult}</ThemedText>
              </ThemedView>
            )}
          </>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  capturedImage: {
    marginTop: 12,
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  loader: {
    marginTop: 8,
  },
  resultBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.15)',
    gap: 4,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
