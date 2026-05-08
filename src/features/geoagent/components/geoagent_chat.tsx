import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { Tooltip as T } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IFeatureCollection } from "types";
import { Loading, TContent } from "@/components/elements";
import SvgGemini from "@/components/icons/gemini";
import { type ToolAction, useGeoAgent } from "@/hooks/use_geoagent";
import { dataAtom, layerConfigAtom } from "@/stores/jotai";
import { usePersistence } from "@/utils/persistence/context";
import type PMap from "@/utils/pmap";

const storage = createJSONStorage<boolean>(() => sessionStorage);
export const geoagentOpenAtom = atomWithStorage<boolean>(
  "geoagentOpen",
  false,
  storage,
);

export function useGeoAgentOpen() {
  const [open, setOpenState] = useAtom(geoagentOpenAtom);
  const toggle = useCallback(() => {
    setOpenState((p) => !p);
  }, [setOpenState]);
  return { open, toggle };
}

function captureMapState(
  map: PMap | null,
  data: { featureMap: Map<string, unknown>; folderMap: Map<string, unknown> },
  layerConfig: Map<string, { id: string; name?: string; visibility?: boolean }>,
) {
  const layers = [];
  for (const [, lc] of layerConfig) {
    layers.push({
      id: lc.id,
      name: lc.name ?? lc.id,
      feature_count: data.featureMap.size,
      geometry_types: [] as string[],
    });
  }

  const viewport = map
    ? {
        center: [map.map.getCenter().lng, map.map.getCenter().lat],
        zoom: map.map.getZoom(),
        bounds: map.map.getBounds().toArray().flat(),
      }
    : null;

  return {
    features:
      data.featureMap.size > 0
        ? ({
            type: "FeatureCollection",
            features: [...data.featureMap.values()].filter(
              (f: any) => f?.wrappedFeature?.feature,
            ),
          } as IFeatureCollection)
        : null,
    layers,
    viewport,
    selection: [],
  };
}

export function GeoAgentChat({
  map,
  open,
  onClose,
}: {
  map: PMap | null;
  open: boolean;
  onClose: () => void;
}) {
  const data = useAtomValue(dataAtom);
  const layerConfig = useAtomValue(layerConfigAtom);
  const transact = usePersistence().useTransact();
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const mapState = useCallback(
    () => captureMapState(map, data, layerConfig),
    [map, data, layerConfig],
  );

  const onAction = useCallback(
    (action: ToolAction) => {
      switch (action.type) {
        case "set_center": {
          const { lat, lng } = action.payload as {
            lat: number;
            lng: number;
          };
          map?.map?.setCenter([lng, lat]);
          break;
        }
        case "set_zoom": {
          const { zoom } = action.payload as { zoom: number };
          map?.map?.setZoom(zoom);
          break;
        }
        case "fly_to": {
          const p = action.payload as {
            lat: number;
            lng: number;
            zoom?: number;
          };
          map?.map?.flyTo({ center: [p.lng, p.lat], zoom: p.zoom });
          break;
        }
        case "zoom_to_bounds": {
          const b = action.payload as {
            west: number;
            south: number;
            east: number;
            north: number;
          };
          map?.map?.fitBounds([
            [b.west, b.south],
            [b.east, b.north],
          ]);
          break;
        }
        case "add_features": {
          const p = action.payload as {
            geojson: string;
            layer_name?: string;
          };
          try {
            const fc = JSON.parse(p.geojson) as IFeatureCollection;
            if (fc.type === "FeatureCollection" && fc.features) {
              const moment: Record<string, unknown> = {
                putFeatures: fc.features.map((f: any) => ({
                  wrappedFeature: { feature: f },
                })),
              };
              transact(moment);
            }
          } catch {}
          break;
        }
      }
    },
    [map, transact],
  );

  const { messages, isLoading, error, sendMessage, clearMessages } =
    useGeoAgent({ mapState, onAction });

  const [input, setInput] = useState("");

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={clsx(
        "absolute bottom-4 right-4 z-50",
        "w-96 h-[32rem]",
        "flex flex-col",
        "bg-white dark:bg-gray-800",
        "border border-gray-300 dark:border-gray-600",
        "rounded-lg shadow-xl",
        "overflow-hidden",
      )}
    >
      {}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-x-2">
          <SvgGemini className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          GeoAgent
        </span>
        <div className="flex items-center gap-x-1">
          <T.Root>
            <T.Trigger asChild>
              <button
                type="button"
                onClick={clearMessages}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    d="M19 7l-1 12.2A2 2 0 0 1 16 21H8a2 2 0 0 1-2-1.8L5 7m5-4h4a1 1 0 0 1 1 1v1H9V4a1 1 0 0 1 1-1zm-6 4h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </T.Trigger>
            <TContent side="bottom">Clear chat</TContent>
          </T.Root>
          <T.Root>
            <T.Trigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </T.Trigger>
            <TContent side="bottom">Close</TContent>
          </T.Root>
        </div>
      </div>

      {}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !error && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-8">
            Ask me anything about your map.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={clsx(
              "text-sm max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap",
              msg.role === "user"
                ? "ml-auto bg-purple-100 dark:bg-purple-900 text-gray-800 dark:text-gray-100"
                : "mr-auto bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100",
            )}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="mr-auto bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
            <Loading size="sm" />
          </div>
        )}
        {error && (
          <div className="text-xs text-red-500 text-center">{error}</div>
        )}
      </div>

      {}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-x-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your map…"
          rows={2}
          className="flex-1 resize-none text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="self-end p-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              d="M5 12h13m-4-4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
