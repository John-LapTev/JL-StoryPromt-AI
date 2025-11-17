
export interface Frame {
  id: string;
  imageUrl: string; // Can be a URL or a base64 string
  prompt: string;
  duration: number; // in seconds
  file?: File; // Store the original file if uploaded, for mimeType etc. This won't be saved.
  isTransition?: boolean;
  isGenerating?: boolean;
}

export interface Asset {
  id: string;
  imageUrl: string; // base64 string for preview
  file: File;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  // Omit 'file' as it cannot be serialized to JSON for localStorage
  frames: Omit<Frame, 'file'>[];
  assets: Omit<Asset, 'file'>[];
  lastModified: number; // Unix timestamp
}