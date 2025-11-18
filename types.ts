export interface Frame {
  id: string;
  imageUrls: string[]; // Can be a URL or a base64 string
  activeVersionIndex: number;
  prompt: string;
  duration: number; // in seconds
  file?: File; // Store the original file if uploaded, for mimeType etc. This won't be saved.
  isTransition?: boolean;
  isGenerating?: boolean;
  generatingMessage?: string;
  aspectRatio?: string; // e.g., '16:9', '4:3'
}

export interface Asset {
  id: string;
  imageUrl: string; // base64 string for preview
  file: File;
  name: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Sketch {
  id: string;
  imageUrl: string;
  prompt: string;
  position: Position;
  size: Size;
  aspectRatio: string;
  file?: File;
}

export interface Note {
  id: string;
  text: string;
  position: Position;
  size: Size;
}


export interface Project {
  id: string;
  name: string;
  // Omit 'file' as it cannot be serialized to JSON for localStorage
  frames: Omit<Frame, 'file'>[];
  assets: Omit<Asset, 'file'>[];
  sketches: Omit<Sketch, 'file'>[];
  notes: Note[];
  lastModified: number; // Unix timestamp
}

export interface StorySettings {
  mode: 'auto' | 'manual';
  prompt: string;
  genre: string;
  ending: string;
}

export interface IntegrationConfig {
  sourceAsset?: Asset | { imageUrl: string, file: File, name: string };
  targetFrame: Frame;
}

export interface AppSettings {
    doubleClickToGenerate: boolean;
}