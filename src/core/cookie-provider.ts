import { createCookieSyncClient, type CookieSyncClient } from '@viyuni/cookie-sync-client';
import { parseCookie } from 'cookie';

import type { CookieSyncConfig } from './types';

export class ListenerCookieProvider {
  private cookie: string;
  private cookieSyncClient: CookieSyncClient | null = null;
  private activeCookiePromise: Promise<string> | null = null;

  constructor(cookie = '', cookieSync?: CookieSyncConfig) {
    this.cookie = cookie;
    if (cookieSync) {
      this.cookieSyncClient = createCookieSyncClient(cookieSync.url, cookieSync.password);
    }
  }

  get value() {
    return this.cookie;
  }

  get buvid() {
    return parseCookie(this.cookie).buvid3 ?? '';
  }

  update(newCookie: string) {
    this.cookie = newCookie;
  }

  async refresh(force = false): Promise<string> {
    if (!this.cookieSyncClient) {
      return this.cookie;
    }

    if (this.cookie && !force) {
      return this.cookie;
    }

    if (this.activeCookiePromise) {
      return this.activeCookiePromise;
    }

    this.activeCookiePromise = new Promise<string>((resolve) => {
      this.cookieSyncClient!.getDecodedCookie()
        .then((cookie) => {
          if (!cookie) {
            console.warn(`Cookie is invalid, using empty cookie instead.`);
          }

          this.update(cookie ?? '');
          resolve(this.cookie);
        })
        .catch((error: unknown) => {
          console.warn(`Fetching cookie failed, using cached cookie instead.`, error);
          resolve(this.cookie);
        })
        .finally(() => {
          this.activeCookiePromise = null;
        });
    });

    return this.activeCookiePromise;
  }
}
