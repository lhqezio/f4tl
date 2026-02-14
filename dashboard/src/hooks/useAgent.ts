import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAgentStatus,
  fetchAgentConfig,
  startAgent,
  cancelAgent,
  type AgentStatus,
  type AgentConfigResponse,
} from '../lib/api';
import { useWebSocket, type WsMessage } from './useWebSocket';

export interface AgentEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export function useAgent() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const { data: status, refetch: refetchStatus } = useQuery<AgentStatus>({
    queryKey: ['agent-status'],
    queryFn: fetchAgentStatus,
    refetchInterval: 3000,
  });

  const { data: config } = useQuery<AgentConfigResponse>({
    queryKey: ['agent-config'],
    queryFn: fetchAgentConfig,
    staleTime: 60_000,
  });

  const handleWsMessage = useCallback(
    (msg: WsMessage) => {
      const type = msg.type as string;
      if (type.startsWith('agent:')) {
        setEvents((prev) => [
          ...prev,
          { type, timestamp: msg.timestamp, data: msg.data as Record<string, unknown> },
        ]);
        // Refetch status on key events
        if (type === 'agent:complete' || type === 'agent:error' || type === 'agent:cancelled') {
          refetchStatus();
        }
      }
    },
    [refetchStatus],
  );

  useWebSocket(handleWsMessage);

  const start = useCallback(
    async (goal: string, opts?: { model?: string; maxTurns?: number }) => {
      setStartError(null);
      setEvents([]);
      try {
        await startAgent(goal, opts);
        await refetchStatus();
      } catch (err) {
        setStartError((err as Error).message);
      }
    },
    [refetchStatus],
  );

  const cancel = useCallback(async () => {
    try {
      await cancelAgent();
      await refetchStatus();
    } catch {
      // ignore
    }
  }, [refetchStatus]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-scroll helper
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return {
    status: status ?? { available: false, running: false },
    config: config ?? null,
    events,
    startError,
    start,
    cancel,
    clearEvents,
    bottomRef,
  };
}
