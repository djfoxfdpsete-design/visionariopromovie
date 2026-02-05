
export type AspectRatio = '16:9' | '9:16' | '4:3';

export interface ImageTask {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  progress: number;
  error?: string;
}

export interface VideoConfig {
  aspectRatio: AspectRatio;
  resolution: '720p' | '1080p';
}

export enum GenerationStep {
  IDLE = 'IDLE',
  AUTH = 'AUTH',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED'
}
