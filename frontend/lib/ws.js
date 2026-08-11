import { tokens, API_URL } from './api';

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  API_URL.replace(/^http/, 'ws');

/**
 * Opens an authenticated WebSocket with automatic exponential-backoff reconnect.
 * Returns a handle with `send(payload)` and `close()`.
 */
export function connect(path, { onMessage, onOpen, onClose } = {}) {
  let socket = null;
  let attempts = 0;
  let closedByUser = false;
  let timer = null;

  const open = () => {
    const token = tokens.access;
    const separator = path.includes('?') ? '&' : '?';
    const url = `${WS_URL}${path}${token ? `${separator}token=${token}` : ''}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      attempts = 0;
      if (onOpen) onOpen();
    };

    socket.onmessage = (event) => {
      if (!onMessage) return;
      try {
        onMessage(JSON.parse(event.data));
      } catch (err) {
        onMessage({ type: 'raw', data: event.data });
      }
    };

    socket.onclose = (event) => {
      if (onClose) onClose(event);
      if (closedByUser || event.code === 4401 || event.code === 4403) return;
      attempts += 1;
      const delay = Math.min(1000 * 2 ** attempts, 15000);
      timer = setTimeout(open, delay);
    };

    socket.onerror = () => {
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    };
  };

  open();

  return {
    send(payload) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    close() {
      closedByUser = true;
      if (timer) clearTimeout(timer);
      if (socket) socket.close();
    },
    get raw() {
      return socket;
    },
  };
}

export default connect;
