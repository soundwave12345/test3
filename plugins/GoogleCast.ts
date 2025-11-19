import { registerPlugin } from '@capacitor/core';

export interface GoogleCastPlugin {
  initialize(): Promise<void>;
  showRoutePicker(): Promise<void>;
  castMedia(options: { 
    url: string; 
    title: string; 
    subtitle: string; 
    imageUrl: string;
    mimeType: string;
    duration: number;
  }): Promise<void>;
}

const GoogleCast = registerPlugin<GoogleCastPlugin>('GoogleCast');

export default GoogleCast;