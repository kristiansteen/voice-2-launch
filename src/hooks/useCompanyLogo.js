import { useState, useCallback, useEffect } from 'react';

function logoKey(userId) {
  return userId ? `ailean_company_logo_${userId}` : null;
}

export function useCompanyLogo(userId) {
  const key = logoKey(userId);
  const [logo, setLogoState] = useState(null);

  // Reload whenever the logged-in user changes
  useEffect(() => {
    if (!key) { setLogoState(null); return; }
    try { setLogoState(localStorage.getItem(key) || null); } catch { setLogoState(null); }
  }, [key]);

  const setLogo = useCallback((dataUrl) => {
    if (key) { try { localStorage.setItem(key, dataUrl); } catch { /* quota */ } }
    setLogoState(dataUrl);
  }, [key]);

  const removeLogo = useCallback(() => {
    if (key) { try { localStorage.removeItem(key); } catch {} }
    setLogoState(null);
  }, [key]);

  // Reads a File and resolves to a data URL, resizing if wider than 800px
  const loadFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const MAX_W = 800;
          if (img.width <= MAX_W) { resolve(dataUrl); return; }
          const canvas = document.createElement('canvas');
          const scale = MAX_W / img.width;
          canvas.width = MAX_W;
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Could not read image'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  return { logo, setLogo, removeLogo, loadFile };
}
