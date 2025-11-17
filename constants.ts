
import type { Frame, Asset } from './types';

// The content of this file has been completely replaced to match the user's original HTML file.
// The previous "robot story" demo has been removed.

export const initialFrames: Omit<Frame, 'file'>[] = [
  {
    id: 'demo-frame-1',
    imageUrls: ['https://lh3.googleusercontent.com/aida-public/AB6AXuBRLutIKzqkVrLU5G8EwCvnB57hZslITqfLdAQ3twCSIXG_wMLbK30U-j-vB0QNqgP2-Jbeq_0JlLUWBIv9vClSsIm7MPae95pubJHCWeM0vlqOagb_pzE8i_p08hC_6e4qcSKuba6GqMjbQ7miH0Y-Fk98vv2Z2xZSRI32PFufaaw9n3KvczDDdnXLmOBtEEP1AfKt0ClcsssNCeKFdtd5MwSzPdgE9S9ajSLa9ZQ2Un_Kofo66XLpUsmOGyDkcJ4Zcp8BgTI_Zeso'],
    activeVersionIndex: 0,
    prompt: 'Slow zoom in, camera pans slightly right to follow the flying car.',
    duration: 5.0,
  },
  {
    id: 'demo-frame-2',
    imageUrls: ['https://lh3.googleusercontent.com/aida-public/AB6AXuAwl8Rgw8s45YtJ--CPGg0eBCTOAB5d4e6PmGJOO0l4fMgPx8Ch4xPGcicATJRzLSVIGFKQbN2gRdBSdkHu48jnC3Jl2msgkXM3mOsKOFIL1uHZ-YEsCcgullUGOTJO2qH6SH0KkozKm-901qCudXdLg_qE7iTaNVIjzoZ2s3tL0_sgRpXfbblJZJd59Ipt8DVqmD8LGHipOifxg7QkcKCZl5hceQjt5CPq32Wm8805AWBhVXT_2Pyuy2sfyxAYqs6KjybEntLTk-sn'],
    activeVersionIndex: 0,
    prompt: 'Quick cut to scientist looking at screen.',
    duration: 3.5,
  },
  {
    id: 'demo-frame-3',
    imageUrls: ['https://lh3.googleusercontent.com/aida-public/AB6AXuAQUJnfubPYYC7ekD3O0zpV6PaU8i4vo-j8WhM028DcSSNrNM73UXxTdUB6MPixTF0CgPjNKtIAmvGppaYFrkx4Rn8ZD8Q-chQXa1gR4IbxvSRhrEbBA39ocaHBWy58Beqy_CqnRqx2d0RmlbVIsxmslCbn3WcAhcSyyiXDC6UXd1yrb3rLDEqmCTtgGXdnyY8a4HmArjzFJO99AnRwOWWEwwGtPYImLcIIF42_sPKFzePOE_4ngxXniGV0o6p8UlL8p50EWpZmqEgm'],
    activeVersionIndex: 0,
    prompt: 'Camera focuses on the anomaly on the screen.',
    duration: 4.0,
  },
  {
    id: 'demo-frame-4',
    imageUrls: ['https://lh3.googleusercontent.com/aida-public/AB6AXuACt_EQbJKKqAhr5F8qhh4oukWB4zTAXQtShO_RltAzmhX2l9fsIjbAKmw7Nzl7D-4v5Aj3dmbrK6MNIH15u7orZl5ujmYRNnQfwhbq6eBhWdKFvs7hGzyeemI-w6L845BEUmyPMOvIQ7Rh7ImMFOvaMeT8A5uucVuNsoTw_NvD_d4__HuV9x6lPjnPg5JHU6mCOBX6je1RlasZsgo4xUjloAaO4hOKVkXYAQm7R8A7qScqHk_yVqnmFChnp0nCm4BJbnaKlVe3Ctg3'],
    activeVersionIndex: 0,
    prompt: '', // This frame has a "Generate prompt" button in the HTML.
    duration: 7.5,
  },
];

// Assets from the old demo are removed as they are not relevant to the new story.
export const initialAssets: Omit<Asset, 'file'>[] = [];