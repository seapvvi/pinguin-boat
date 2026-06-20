'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface PopupData {
  message: string;
  duration: number;
  createdAt?: number;
}

interface UseSSEOptions {
  onPopup?: (popup: PopupData) => void;
}

interface UseSSEResult {
  popup: PopupData | null;
}

export function useSSE(options?: UseSSEOptions): UseSSEResult {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const onPopupRef = useRef(options?.onPopup);
  onPopupRef.current = options?.onPopup;

  const connect = useCallback(() => {
    const eventSource = new EventSource('/api/owner/events', { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PopupData;
        setPopup(data);
        onPopupRef.current?.(data);
      } catch {
        /* ignore malformed events */
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(connect, 3000);
    };

    return eventSource;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);

  return { popup };
}
