import { expect, test } from 'vite-plus/test';

import { ListenerCookieProvider } from '../src/core/cookie-provider.ts';

test('ListenerCookieProvider returns the manual cookie without sync config', async () => {
  const provider = new ListenerCookieProvider('SESSDATA=abc; buvid3=buvid-value');

  await expect(provider.refresh()).resolves.toBe('SESSDATA=abc; buvid3=buvid-value');
  expect(provider.value).toBe('SESSDATA=abc; buvid3=buvid-value');
  expect(provider.buvid).toBe('buvid-value');
});

test('ListenerCookieProvider can update cookies and derived buvid', () => {
  const provider = new ListenerCookieProvider('buvid3=old');

  provider.update('foo=bar; buvid3=new; baz=qux');

  expect(provider.value).toBe('foo=bar; buvid3=new; baz=qux');
  expect(provider.buvid).toBe('new');
});

test('ListenerCookieProvider returns an empty buvid when the cookie is missing it', () => {
  const provider = new ListenerCookieProvider('SESSDATA=abc');

  expect(provider.buvid).toBe('');
});
