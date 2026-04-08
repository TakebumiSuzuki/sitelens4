import { describe, it, expect, vi } from 'vitest';
import { getState, setState, subscribe } from '@/utils/storage';

describe('storage — getState / setState の統合動作', () => {
  it('初期状態は status: idle を返す', async () => {
    const state = await getState();
    expect(state.status).toBe('idle');
  });

  it('setState でフィールドを上書きできる', async () => {
    await setState({ status: 'analyzing', domain: 'https://example.com' });
    const state = await getState();
    expect(state.status).toBe('analyzing');
    expect(state.domain).toBe('https://example.com');
  });

  it('setState は既存フィールドを保持したまま部分更新する', async () => {
    await setState({ status: 'analyzing', domain: 'https://example.com' });
    await setState({ status: 'searching' });
    const state = await getState();
    expect(state.status).toBe('searching');
    expect(state.domain).toBe('https://example.com'); // 保持されている
  });

  it('複数回の setState が正しく積み重なる（analyzing → searching → done）', async () => {
    await setState({ status: 'analyzing', domain: 'https://example.com' });
    await setState({ status: 'searching', data: {
      company_name: 'Example Corp',
      year_founded: 2000,
      headquarters: 'Tokyo',
      description: 'desc',
      products_and_services: 'SaaS',
      search_query: 'example corp news',
    }});
    await setState({ status: 'done', urls: ['https://news.example.com'] });

    const state = await getState();
    expect(state.status).toBe('done');
    expect(state.domain).toBe('https://example.com');
    expect(state.data?.company_name).toBe('Example Corp');
    expect(state.urls).toEqual(['https://news.example.com']);
  });

  it('updatedAt は setState のたびに更新される', async () => {
    const before = Date.now();
    await setState({ status: 'analyzing' });
    const s1 = await getState();
    await setState({ status: 'done' });
    const s2 = await getState();

    expect(s2.updatedAt).toBeGreaterThanOrEqual(s1.updatedAt);
    expect(s1.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('storage — subscribe の統合動作', () => {
  it('setState 後に subscribe コールバックが呼ばれる', async () => {
    const cb = vi.fn();
    subscribe(cb);
    await setState({ status: 'analyzing' });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].status).toBe('analyzing');
  });

  it('subscribe が返す関数を呼ぶとコールバックが解除される', async () => {
    const cb = vi.fn();
    const unsubscribe = subscribe(cb);
    unsubscribe();
    await setState({ status: 'analyzing' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('複数のサブスクライバーが全員通知を受け取る', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribe(cb1);
    subscribe(cb2);
    await setState({ status: 'done' });
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });
});
