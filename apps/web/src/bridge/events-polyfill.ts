/**
 * Minimal browser-compatible EventEmitter polyfill.
 * cheerio → htmlparser2 → Node.js "events" module requires this in the browser.
 * Used as a resolve.alias target in vite.config.ts for browser-only dev mode.
 */

type Listener = (...args: any[]) => void;

export class EventEmitter {
  private _events: Record<string, Listener[]> = {};

  on(event: string, listener: Listener): this {
    (this._events[event] ??= []).push(listener);
    return this;
  }

  once(event: string, listener: Listener): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    (this._events[event] ??= []).push(wrapper);
    return this;
  }

  off(event: string, listener: Listener): this {
    const list = this._events[event];
    if (list) {
      this._events[event] = list.filter((l) => l !== listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._events[event];
    if (!list || list.length === 0) return false;
    for (const fn of list.slice()) fn(...args);
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this._events[event];
    } else {
      this._events = {};
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._events[event]?.length ?? 0;
  }

  listeners(event: string): Listener[] {
    return this._events[event]?.slice() ?? [];
  }
}

export default EventEmitter;
