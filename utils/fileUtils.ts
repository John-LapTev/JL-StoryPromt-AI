

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error("Invalid data URL format");
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

export async function fetchCorsImage(url: string): Promise<Blob> {
    try {
        const directResponse = await fetch(url);
        if (!directResponse.ok) {
            throw new Error(`Direct fetch failed with status: ${directResponse.status}`);
        }
        return await directResponse.blob();
    } catch (e) {
        console.warn(`Direct fetch for ${url} failed, falling back to CORS proxy. Error:`, e);
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const proxyResponse = await fetch(proxiedUrl);
        if (!proxyResponse.ok) {
            throw new Error(`Failed to fetch image via proxy: ${proxyResponse.statusText}`);
        }
        return await proxyResponse.blob();
    }
}

export function getImageDimensions(fileOrDataUrl: File | string): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = typeof fileOrDataUrl !== 'string' ? URL.createObjectURL(fileOrDataUrl) : undefined;

        image.onload = () => {
            resolve({ width: image.width, height: image.height });
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
        image.onerror = (err) => {
            reject(err);
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
        
        image.src = objectUrl || (fileOrDataUrl as string);
    });
}

export function createImageOnCanvas(imageUrl: string, targetRatioString: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "Anonymous"; // Attempt to load cross-origin images without tainting canvas

        const processImage = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Could not get canvas context"));

            const [targetW, targetH] = targetRatioString.split(':').map(Number);
            if (isNaN(targetW) || isNaN(targetH) || targetH === 0) return reject(new Error("Invalid target ratio string"));
            const targetRatio = targetW / targetH;

            const originalWidth = image.naturalWidth;
            const originalHeight = image.naturalHeight;
            
            let canvasWidth: number, canvasHeight: number;
            let dx = 0, dy = 0;

            if (originalWidth / originalHeight > targetRatio) {
                // Original is wider than target, so add space top/bottom (letterboxing)
                canvasWidth = originalWidth;
                canvasHeight = Math.round(originalWidth / targetRatio);
                dy = Math.round((canvasHeight - originalHeight) / 2);
            } else {
                // Original is narrower than target, so add space left/right (pillarboxing)
                canvasHeight = originalHeight;
                canvasWidth = Math.round(originalHeight * targetRatio);
                dx = Math.round((canvasWidth - originalWidth) / 2);
            }

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Fill with black to give the model a clear area to inpaint
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(image, dx, dy, originalWidth, originalHeight);
            resolve(canvas.toDataURL('image/png'));
        };

        let objectURL: string | undefined;
        image.onload = () => {
            processImage();
            if (objectURL) URL.revokeObjectURL(objectURL);
        };
        image.onerror = (err) => {
            if (objectURL) URL.revokeObjectURL(objectURL);
            reject(new Error(`Image load failed: ${err}`));
        };

        try {
            if (imageUrl.startsWith('http')) {
                const blob = await fetchCorsImage(imageUrl);
                objectURL = URL.createObjectURL(blob);
                image.src = objectURL;
            } else { // It's a data URL
                image.src = imageUrl;
            }
        } catch (error) {
            reject(error);
        }
    });
}