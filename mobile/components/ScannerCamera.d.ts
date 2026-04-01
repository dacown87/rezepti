import type { ComponentType } from 'react';

interface ScannerCameraProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

declare const ScannerCamera: ComponentType<ScannerCameraProps>;
export default ScannerCamera;
