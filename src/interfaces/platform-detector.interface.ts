export type PlatformType = 'web' | 'mobile' | 'server'
export type MobilePlatform = 'android' | 'ios' | 'web' | 'unknown'

export interface PlatformDetector {
  /**
   * Detect the current platform
   */
  getPlatform(): PlatformType
  
  /**
   * Check if running on server (Node.js)
   */
  isServer(): boolean
  
  /**
   * Check if running in browser
   */
  isBrowser(): boolean
  
  /**
   * Check if running on mobile device
   */
  isMobile(): boolean
  
  /**
   * Get specific mobile platform
   */
  getMobilePlatform(): MobilePlatform
  
  /**
   * Check if on Android
   */
  isAndroid(): boolean
  
  /**
   * Check if on iOS
   */
  isIOS(): boolean
  
  /**
   * Check if touch device
   */
  isTouchDevice(): boolean
  
  /**
   * Get user agent string
   */
  getUserAgent(): string
  
  /**
   * Get screen dimensions
   */
  getScreenSize(): { width: number; height: number }
  
  /**
   * Check if device is offline
   */
  isOffline(): boolean
  
  /**
   * Get connection type
   */
  getConnectionType(): 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'wimax' | 'other' | 'unknown'
}

export interface DeviceInfo {
  platform: PlatformType
  mobilePlatform: MobilePlatform
  isTouchDevice: boolean
  screenSize: { width: number; height: number }
  userAgent: string
  isOffline: boolean
  connectionType: string
  features: {
    fileSystem: boolean
    camera: boolean
    geolocation: boolean
    pushNotifications: boolean
    biometrics: boolean
  }
}