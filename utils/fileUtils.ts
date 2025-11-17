
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