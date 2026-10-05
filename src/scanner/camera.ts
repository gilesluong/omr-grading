export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  shortLabel: string; // "0.5x", "1x", "2x", "3x", "Front"
  zoomLabel: string; // "0.5", "1", "2", "3"
  zoomValue: number; // 0.5, 1, 2, 3, etc.
  isBack: boolean;
}

const CAMERA_STORAGE_KEY = 'omr_selected_camera_id';

export function loadSavedCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSelectedCameraId(deviceId: string): void {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, deviceId);
  } catch {
    // ignore storage errors
  }
}

export function parseCameraDevices(
  devices: MediaDeviceInfo[],
): CameraDeviceOption[] {
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');
  if (videoInputs.length === 0) return [];

  // Check if discrete physical cameras exist
  const hasDiscreteUltra = videoInputs.some((d) => {
    const l = (d.label || '').toLowerCase();
    return l.includes('ultra') || l.includes('0.5') || l.includes('ultrawide');
  });
  const hasDiscreteTele = videoInputs.some((d) => {
    const l = (d.label || '').toLowerCase();
    return l.includes('tele') || l.includes('3x') || l.includes('2x');
  });
  const hasDiscreteBack = videoInputs.some((d) => {
    const l = (d.label || '').toLowerCase();
    return (
      (l.includes('back camera') || l.includes('wide') || l.includes('facing back')) &&
      !l.includes('dual') &&
      !l.includes('triple')
    );
  });

  // Filter out iOS virtual composite devices (Dual Camera, Triple Camera, LiDAR) if discrete physical cameras exist
  const filteredInputs = videoInputs.filter((d) => {
    const l = (d.label || '').toLowerCase();
    const isComposite =
      l.includes('dual camera') ||
      l.includes('triple camera') ||
      l.includes('dual wide') ||
      l.includes('lidar');
    if (isComposite && (hasDiscreteUltra || hasDiscreteTele || hasDiscreteBack)) {
      return false;
    }
    return true;
  });

  const parsedList: CameraDeviceOption[] = [];
  const seenRearZooms = new Set<number>();
  let frontAdded = false;

  for (let index = 0; index < filteredInputs.length; index++) {
    const d = filteredInputs[index];
    const rawLabel = d.label || '';
    const lower = rawLabel.toLowerCase();
    let isBack = true;
    let shortLabel = '';
    let zoomLabel = '';
    let zoomValue = 1.0;

    if (
      lower.includes('front') ||
      lower.includes('user') ||
      lower.includes('selfie') ||
      lower.includes('1, facing front')
    ) {
      isBack = false;
      shortLabel = 'Front';
      zoomLabel = 'Front';
      zoomValue = 999;
    } else if (
      lower.includes('ultra') ||
      lower.includes('0.5') ||
      lower.includes('ultrawide')
    ) {
      shortLabel = '0.5x';
      zoomLabel = '0.5';
      zoomValue = 0.5;
    } else if (lower.includes('tele') || lower.includes('3x')) {
      shortLabel = '3x';
      zoomLabel = '3';
      zoomValue = 3.0;
    } else if (lower.includes('2x')) {
      shortLabel = '2x';
      zoomLabel = '2';
      zoomValue = 2.0;
    } else if (
      lower.includes('back') ||
      lower.includes('rear') ||
      lower.includes('environment') ||
      lower.includes('0, facing back')
    ) {
      shortLabel = '1x';
      zoomLabel = '1';
      zoomValue = 1.0;
    } else {
      shortLabel = `Cam ${index + 1}`;
      zoomLabel = `${index + 1}`;
      zoomValue = 10 + index;
    }

    // Deduplicate rear cameras with identical zoom factor so we don't display duplicate 1x
    if (isBack) {
      if (seenRearZooms.has(zoomValue)) {
        continue;
      }
      seenRearZooms.add(zoomValue);
    } else {
      if (frontAdded) {
        continue;
      }
      frontAdded = true;
    }

    const label =
      rawLabel || (isBack ? `Rear Camera ${index + 1}` : 'Front Camera');

    parsedList.push({
      deviceId: d.deviceId,
      label,
      shortLabel,
      zoomLabel,
      zoomValue,
      isBack,
    });
  }

  // Sort rear cameras ascending by optical zoom: 0.5x -> 1x -> 2x -> 3x, then front camera at end
  const rearCameras = parsedList
    .filter((c) => c.isBack)
    .sort((a, b) => a.zoomValue - b.zoomValue);
  const frontCameras = parsedList.filter((c) => !c.isBack);

  return [...rearCameras, ...frontCameras];
}

export function getRearLenses(cameras: CameraDeviceOption[]): CameraDeviceOption[] {
  return cameras.filter((c) => c.isBack).sort((a, b) => a.zoomValue - b.zoomValue);
}

export function getFrontCamera(cameras: CameraDeviceOption[]): CameraDeviceOption | undefined {
  return cameras.find((c) => !c.isBack);
}
