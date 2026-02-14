import { useEffect, useRef, useState, useCallback } from 'react';

export interface WsMessage {
  type: string;
  sessionId: string;
  timestamp: number;
  data: unknown;
}

const MAX_RETRIES = 20;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

export function useWebSocket(onMessage?: (msg: WsMessage) => void) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const connectRef = useRef<() => void>();
  const retriesRef = useRef(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const connect = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      setReconnectAttempt(0);
      retriesRef.current = 0;
    };
    ws.onclose = () => {
      setConnected(false);
      if (retriesRef.current < MAX_RETRIES) {
        setReconnecting(true);
        retriesRef.current += 1;
        setReconnectAttempt(retriesRef.current);
        const delay = Math.min(BASE_DELAY * Math.pow(2, retriesRef.current - 1), MAX_DELAY);
        setTimeout(() => connectRef.current?.(), delay);
      } else {
        setReconnecting(false);
      }
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data);
        onMessageRef.current?.(msg);
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    connect();
    return () => {
      retriesRef.current = MAX_RETRIES; // prevent reconnect on unmount
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, reconnecting, reconnectAttempt };
}
