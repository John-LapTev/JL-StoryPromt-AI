export interface Frame {
  id: string;
  imageUrl: string; // Can be a URL or a base64 string
  prompt: string;
  duration: number; // in seconds
  file?: File; // Store the original file if uploaded, for mimeType etc.
  isTransition?: boolean;
}