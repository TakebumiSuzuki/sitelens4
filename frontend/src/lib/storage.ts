import type { StoredState } from '@/types/analyze';

const KEY = 'sitelens.state';

export async function getState(): Promise<StoredState> {
  const result = await chrome.storage.local.get(KEY);
  return (
    (result[KEY] as StoredState) ?? {
      status: 'idle',
      updatedAt: Date.now(),
    }
  );
}

export async function setState(patch: Partial<StoredState>): Promise<StoredState> {
  const current = await getState();
  const next: StoredState = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function subscribe(cb: (state: StoredState) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[KEY]) {
      cb(changes[KEY].newValue as StoredState);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
