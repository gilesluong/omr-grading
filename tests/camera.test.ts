import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCameraDevices,
  loadSavedCameraId,
  saveSelectedCameraId,
} from '../src/scanner/camera';

describe('Camera Device & Lens Enumeration', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      clear: () => store.clear(),
      removeItem: (key: string) => store.delete(key),
    };
  });

  it('correctly maps iPhone multi-lens setup (ultra-wide, main, telephoto, front)', () => {
    const mockDevices = [
      { kind: 'videoinput', deviceId: 'id-main', label: 'Back Camera' },
      { kind: 'videoinput', deviceId: 'id-ultra', label: 'Back Ultra Wide Camera' },
      { kind: 'videoinput', deviceId: 'id-tele', label: 'Back Telephoto Camera' },
      { kind: 'videoinput', deviceId: 'id-front', label: 'Front Camera' },
      { kind: 'audioinput', deviceId: 'id-mic', label: 'Microphone' },
    ] as MediaDeviceInfo[];

    const parsed = parseCameraDevices(mockDevices);
    expect(parsed).toHaveLength(4);

    // Sorted ascending by zoom: 0.5x -> 1x -> 3x, then Front
    expect(parsed[0]).toEqual({
      deviceId: 'id-ultra',
      label: 'Back Ultra Wide Camera',
      shortLabel: '0.5x',
      zoomLabel: '0.5',
      zoomValue: 0.5,
      isBack: true,
    });

    expect(parsed[1]).toEqual({
      deviceId: 'id-main',
      label: 'Back Camera',
      shortLabel: '1x',
      zoomLabel: '1',
      zoomValue: 1.0,
      isBack: true,
    });

    expect(parsed[2]).toEqual({
      deviceId: 'id-tele',
      label: 'Back Telephoto Camera',
      shortLabel: '3x',
      zoomLabel: '3',
      zoomValue: 3.0,
      isBack: true,
    });

    expect(parsed[3]).toEqual({
      deviceId: 'id-front',
      label: 'Front Camera',
      shortLabel: 'Front',
      zoomLabel: 'Front',
      zoomValue: 999,
      isBack: false,
    });
  });

  it('filters out iOS virtual composite cameras (dual/triple) when discrete lenses exist', () => {
    const mockDevices = [
      { kind: 'videoinput', deviceId: 'id-main', label: 'Back Camera' },
      { kind: 'videoinput', deviceId: 'id-ultra', label: 'Back Ultra Wide Camera' },
      { kind: 'videoinput', deviceId: 'id-tele', label: 'Back Telephoto Camera' },
      { kind: 'videoinput', deviceId: 'id-dual', label: 'Back Dual Camera' },
      { kind: 'videoinput', deviceId: 'id-triple', label: 'Back Triple Camera' },
      { kind: 'videoinput', deviceId: 'id-front', label: 'Front Camera' },
    ] as MediaDeviceInfo[];

    const parsed = parseCameraDevices(mockDevices);
    // Only 0.5x, 1x, 3x, and Front should remain (4 items, no duplicate 1x)
    expect(parsed).toHaveLength(4);
    expect(parsed.map((c) => c.shortLabel)).toEqual(['0.5x', '1x', '3x', 'Front']);
  });

  it('persists and restores chosen camera device id', () => {
    expect(loadSavedCameraId()).toBeNull();
    saveSelectedCameraId('id-ultra');
    expect(loadSavedCameraId()).toBe('id-ultra');
  });

  it('handles generic device labels gracefully', () => {
    const mockDevices = [
      { kind: 'videoinput', deviceId: 'dev-1', label: '' },
      { kind: 'videoinput', deviceId: 'dev-2', label: '' },
    ] as MediaDeviceInfo[];

    const parsed = parseCameraDevices(mockDevices);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].label).toBe('Rear Camera 1');
    expect(parsed[1].label).toBe('Rear Camera 2');
  });
});
