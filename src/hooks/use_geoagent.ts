import { useCallback, useState } from "react";

const BACKEND_URL =
  import.meta.env.VITE_PUBLIC_GEOAGENT_URL ?? "http://localhost:8000";

export interface ToolAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface GeoAgentResponse {
  message: string;
  actions: ToolAction[];
  tool_calls: string[];
  conversation_id: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UseGeoAgentOptions {
  mapState: () => Record<string, unknown> | null;
  onAction: (action: ToolAction) => void;
}

export interface UseGeoAgentReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

export function useGeoAgent({
  mapState,
  onAction,
}: UseGeoAgentOptions): UseGeoAgentReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);

      const userMessage: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const body = {
          message: text,
          map_state: mapState(),
        };

        const res = await fetch(`${BACKEND_URL}/api/geoagent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            (errBody as { detail?: string }).detail ??
              `Server error (${res.status})`,
          );
        }

        const data = (await res.json()) as GeoAgentResponse;

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        for (const action of data.actions) {
          onAction(action);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [mapState, onAction],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
