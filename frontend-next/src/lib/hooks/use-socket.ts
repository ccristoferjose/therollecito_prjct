'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/config/env';

type Listeners = Record<string, (...args: unknown[]) => void>;

/**
 * Connect to a Socket.IO namespace and register event listeners.
 * Connects directly to NEXT_PUBLIC_SOCKET_URL (websockets aren't proxied).
 */
export function useSocket(
  namespace: string,
  query?: Record<string, unknown>,
  listeners?: Listeners,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const base = env.socketUrl || 'http://localhost:3001';
    const socket = io(`${base}${namespace}`, {
      query: query as Record<string, string>,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    if (listeners) {
      for (const [event, handler] of Object.entries(listeners)) {
        socket.on(event, handler);
      }
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, JSON.stringify(query)]);

  return socketRef;
}
