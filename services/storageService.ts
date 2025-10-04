const DB_NAME = 'ThespianDigitalDB';
const DB_VERSION = 3; // Bump version for schema change
const SCRIPT_STORE = 'scriptStore';
const VIDEO_STORE = 'videoStore';
const AUDIO_STORE = 'audioStore';
const CONFIG_STORE = 'configStore';

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening DB');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SCRIPT_STORE)) {
        db.createObjectStore(SCRIPT_STORE);
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
    };
  });
};

export const saveVdoNinjaUrl = async (url: string): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(CONFIG_STORE, 'readwrite');
    const store = tx.objectStore(CONFIG_STORE);
    store.put(url, 'vdoNinjaUrl');
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getVdoNinjaUrl = async (): Promise<string | null> => {
    const db = await openDB();
    const tx = db.transaction(CONFIG_STORE, 'readonly');
    const store = tx.objectStore(CONFIG_STORE);
    const request = store.get('vdoNinjaUrl');
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const saveScript = async (name: string, text: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(SCRIPT_STORE, 'readwrite');
  const store = tx.objectStore(SCRIPT_STORE);
  store.put({ name, text }, 'userScript');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getScript = async (): Promise<{ name: string; text: string } | null> => {
  const db = await openDB();
  const tx = db.transaction(SCRIPT_STORE, 'readonly');
  const store = tx.objectStore(SCRIPT_STORE);
  const request = store.get('userScript');
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const saveVideos = async (videos: File[]): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(VIDEO_STORE, 'readwrite');
    const store = tx.objectStore(VIDEO_STORE);
    store.clear(); // Clear old videos
    videos.forEach((video) => {
        store.put(video);
    });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getVideos = async (): Promise<File[] | null> => {
    const db = await openDB();
    const tx = db.transaction(VIDEO_STORE, 'readonly');
    const store = tx.objectStore(VIDEO_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const videos = request.result as File[];
            if (videos && videos.length > 0) {
                const idleVideoIndex = videos.findIndex(v => v.name.toLowerCase().startsWith('idle'));
                if (idleVideoIndex > -1) {
                    const idleVideo = videos[idleVideoIndex];
                    const otherVideos = videos.filter((_, i) => i !== idleVideoIndex);
                    otherVideos.sort((a, b) => {
                        const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
                        const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');
                        return numA - numB;
                    });
                    resolve([idleVideo, ...otherVideos]);
                } else {
                    videos.sort((a, b) => a.name.localeCompare(b.name));
                    resolve(videos);
                }
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
};


export const saveAudio = async (audioFiles: File[]): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    store.clear(); // Clear old audio files
    audioFiles.forEach((audio) => {
        store.put(audio);
    });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getAudio = async (): Promise<File[] | null> => {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const store = tx.objectStore(AUDIO_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const audioFiles = (request.result as File[]).sort((a, b) => {
                const numA = parseInt(a.name.match(/^\d+/)?.[0] || '0');
                const numB = parseInt(b.name.match(/^\d+/)?.[0] || '0');
                return numA - numB;
            });
            resolve(audioFiles.length > 0 ? audioFiles : null);
        };
        request.onerror = () => reject(request.error);
    });
};


export const clearAllData = async (): Promise<void> => {
    const db = await openDB();
    const storesToClear = [SCRIPT_STORE, VIDEO_STORE, AUDIO_STORE, CONFIG_STORE];
    const promises = storesToClear.map(storeName => 
        new Promise<void>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        })
    );
    await Promise.all(promises);
};