import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Connect to a Socket.IO namespace and listen for events.
 * @param {string} namespace - e.g. '/kitchen'
 * @param {object} query - e.g. { location_id: 1 }
 * @param {object} listeners - e.g. { order_paid: (data) => ... }
 */
export function useSocket(namespace, query, listeners) {
  const socketRef = useRef(null);

  useEffect(() => {
    const base = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    const socket = io(`${base}${namespace}`, {
      query,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    if (listeners) {
      Object.entries(listeners).forEach(([event, handler]) => {
        socket.on(event, handler);
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [namespace, JSON.stringify(query)]);

  return socketRef;
}
