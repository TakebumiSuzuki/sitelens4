import { vi } from 'vitest';

// chrome.storage.local のモック
// onChanged は手動で発火できるよう listeners を保持する
const storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>) => void> = [];
const storageData: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: storageData[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) {
          const oldValue = storageData[k];
          storageData[k] = v;
          // onChanged listeners に通知
          for (const listener of storageListeners) {
            listener({ [k]: { oldValue, newValue: v } });
          }
        }
      }),
    },
    onChanged: {
      addListener: vi.fn((cb: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
        storageListeners.push(cb);
      }),
      removeListener: vi.fn((cb: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
        const idx = storageListeners.indexOf(cb);
        if (idx !== -1) storageListeners.splice(idx, 1);
      }),
    },
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
};

// @ts-expect-error - グローバルに chrome を注入
globalThis.chrome = chromeMock;

// 各テスト前にストレージをリセット
beforeEach(() => {
  for (const key of Object.keys(storageData)) {
    delete storageData[key];
  }
  storageListeners.length = 0;
  vi.clearAllMocks();

  // set のモックを再定義（clearAllMocks で実装が消えるため）
  chromeMock.storage.local.get.mockImplementation(async (key: string) => ({
    [key]: storageData[key],
  }));
  chromeMock.storage.local.set.mockImplementation(async (items: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(items)) {
      const oldValue = storageData[k];
      storageData[k] = v;
      for (const listener of storageListeners) {
        listener({ [k]: { oldValue, newValue: v } });
      }
    }
  });
});
