import Drop from "@/components/drop";
import Modes from "@/components/modes";
import { Dialogs } from "@/features/dialogs";
import {
  GeoAgentChat,
  useGeoAgentOpen,
} from "@/features/geoagent/components/geoagent_chat";
import { MapComponent } from "@/features/map/components/map_component";
import { HelpDot } from "@/features/menu_bar";
import { MenuBarDropdown } from "@/features/menu_bar/components/menu_bar_dropdown";
import type PMap from "@/utils/pmap";
import "@/assets/styles/globals.css";
import "core-js/features/array/at";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  BoxModelIcon,
  LayoutIcon,
  MoveIcon,
  UpdateIcon,
  ViewHorizontalIcon,
} from "@radix-ui/react-icons";
import clsx from "clsx";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import debounce from "lodash/debounce";
import { Tooltip as T } from "radix-ui";
import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { match } from "ts-pattern";
import { useSearchParams } from "wouter";
import { ErrorBoundary } from "@/components/elements";
import { Keybindings } from "@/components/keybindings";
import { Legend } from "@/components/legend";
import Notifications from "@/components/notifications";
import {
  BottomResizer,
  Resizer,
  useBigScreen,
  useWindowResizeSplits,
} from "@/components/resizer";
import ContextActions from "@/features/context_actions";
import { BottomPanel, FullPanel, SidePanel } from "@/features/panels";
import { FeatureEditorFolder } from "@/features/panels/components/feature_editor/feature_editor_folder";
import { useImportFile, useImportString } from "@/hooks/use_import";
import { MapContext } from "@/providers/map_context";
import {
  dialogAtom,
  splitsAtom,
  TabOption,
  tabAtom,
  themeAtom,
} from "@/stores/jotai";
import { DEFAULT_IMPORT_OPTIONS, detectType } from "@/utils/convert";
import { Button, StyledTooltipArrow, TContent } from "./elements";
import { Visual } from "./visual";

function ContextActionsWithDivider() {
  return <ContextActions />;
}

type ResolvedLayout = "HORIZONTAL" | "VERTICAL" | "FLOATING";

interface Transform {
  x: number;
  y: number;
}

const persistentTransformAtom = atom<Transform>({
  x: 5,
  y: 5,
});

function UrlAPI() {
  const doImportString = useImportString();
  const setDialogState = useSetAtom(dialogAtom);
  const doImportFile = useImportFile();
  const [searchParams] = useSearchParams();
  const load = searchParams?.get("load");
  const done = useRef<boolean>(false);

  useEffect(() => {
    if (load && !done.current) {
      done.current = true;
      (async () => {
        try {
          const url = new URL(load);
          if (url.protocol === "https:") {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            const file = new File(
              [buffer],
              url.pathname.split("/").pop() || "",
              {
                type: res.headers.get("Content-Type") || "",
              },
            );
            const options = (await detectType(file)).unsafeCoerce();
            doImportFile(file, options, () => {});
          } else if (url.protocol === "data:") {
            const [description, ...parts] = url.pathname.split(",");
            const data = parts.join(",");
            const [type, encoding] = description.split(";", 2) as [
              string,
              string | undefined,
            ];

            const decoded = match(encoding)
              .with(undefined, () => decodeURIComponent(data))
              .with("base64", () => atob(data))
              .otherwise(() => {
                throw new Error("Unknown encoding in data url");
              });

            if (type === "application/json") {
              doImportString(
                decoded,
                {
                  ...DEFAULT_IMPORT_OPTIONS,
                  type: "geojson",
                },
                (...args) => {
                  // eslint-disable-next-line no-console
                  console.log(args);
                },
              );
            } else {
              setDialogState({
                type: "load_text",
                initialValue: decoded,
              });
            }
          } else {
            toast.error(
              "Couldn’t handle this ?load argument - urls and data urls are supported",
            );
          }
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Failed to load data from URL",
          );
        }
      })();
    }
  }, [load, doImportString, doImportFile, setDialogState]);

  return null;
}

export function AppMain() {
  const [map, setMap] = useState<PMap | null>(null);
  useWindowResizeSplits();
  const splits = useAtomValue(splitsAtom);
  const isBigScreen = useBigScreen();

  let layout: ResolvedLayout = "HORIZONTAL";

  switch (splits.layout) {
    case "VERTICAL":
      layout = "VERTICAL";
      break;
    case "AUTO":
      layout = isBigScreen ? "HORIZONTAL" : "VERTICAL";
      break;
    case "FLOATING": {
      layout = "FLOATING";
      break;
    }
  }

  const sensor = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
  );

  const [persistentTransform, setPersistentTransform] = useAtom(
    persistentTransformAtom,
  );

  const theme = useAtomValue(themeAtom);

  const { open: geoAgentOpen, toggle: toggleGeoAgent } = useGeoAgentOpen();

  return (
    <main
      className={clsx([
        "h-screen flex flex-col bg-white dark:bg-gray-800",
        theme === "dark" ? "dark" : "",
      ])}
    >
      <T.Provider>
        <MapContext.Provider value={map}>
          <ErrorBoundary
            fallback={(props) => {
              return (
                <div className="h-20 flex items-center justify-center px-2 gap-x-2">
                  An error occurred
                  <Button onClick={() => props.resetError()}>
                    <UpdateIcon /> Try again
                  </Button>
                </div>
              );
            }}
          >
            <div className="h-16 bg-gray-100 dark:bg-gray-800 shadow-xs">
              <div
                className="flex flex-row items-center justify-between overflow-x-auto sm:overflow-visible
           h-16 px-4"
              >
                <div className="flex flex-1 items-center justify-start gap-x-6">
                  <span
                    className="py-1 pl-2 pr-2
                    text-purple-600 dark:text-purple-300
                    inline-flex items-center text-2xl font-bold tracking-tighter"
                    title="Home"
                  >
                    Geon
                  </span>
                  <MenuBarDropdown />
                  <HelpDot />
                </div>
                <div className="flex items-center justify-center gap-x-8">
                  <Modes replaceGeometryForId={null} />
                  <ContextActionsWithDivider />
                  <Visual />
                </div>
                <div className="flex flex-1" />
              </div>
            </div>
          </ErrorBoundary>
          <div
            className={clsx(
              layout === "VERTICAL" && "flex-col",
              "flex flex-auto relative border-t border-gray-200 dark:border-gray-900",
            )}
          >
            {layout === "HORIZONTAL" ? (
              <FeatureEditorFolder />
            ) : layout === "FLOATING" ? (
              <FullPanel />
            ) : null}
            <DndContext
              sensors={sensor}
              modifiers={[restrictToWindowEdges]}
              onDragEnd={(end) => {
                setPersistentTransform((transform) => {
                  return {
                    x: transform.x + end.delta.x,
                    y: transform.y + end.delta.y,
                  };
                });
              }}
            >
              <DraggableMap
                persistentTransform={persistentTransform}
                setMap={setMap}
                layout={layout}
              />
            </DndContext>
            {layout === "HORIZONTAL" ? (
              <>
                <SidePanel />
                <Resizer side="left" />
                <Resizer side="right" />
              </>
            ) : layout === "VERTICAL" ? (
              <>
                <BottomPanel />
                <BottomResizer />
              </>
            ) : null}
          </div>
          <Drop />
          <UrlAPI />
          <Dialogs />
          <Suspense fallback={null}>
            <Keybindings />
          </Suspense>
          <Notifications />
          <GeoAgentChat
            map={map}
            open={geoAgentOpen}
            onClose={toggleGeoAgent}
          />
        </MapContext.Provider>
      </T.Provider>
    </main>
  );
}

function DraggableMap({
  setMap,
  layout,
  persistentTransform,
}: {
  setMap: (arg0: PMap | null) => void;
  layout: ResolvedLayout;
  persistentTransform: Transform;
}) {
  const [splits, setSplits] = useAtom(splitsAtom);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "map",
  });

  useMapResize(containerRef.current, layout);

  const SELECTED = "bg-gray-100 dark:bg-gray-700 dark:text-gray-100";
  const UNSELECTED =
    "dark:bg-black text-gray-300 dark:text-gray-500 hover:text-gray-400";

  const switchToFloating = useAtomCallback(
    useCallback((get, set) => {
      set(splitsAtom, {
        ...get(splitsAtom),
        layout: "FLOATING",
      });

      set(tabAtom, TabOption.Table);

      // Size - this is w-64
      const SIZE = 256;
      // Distance from screen edge
      const MARGIN = 32;
      // Height of the double header
      const HEADER_HEIGHT = 48 * 2;
      const transform: Transform = {
        x: window.innerWidth - SIZE - MARGIN,
        y: window.innerHeight - SIZE - MARGIN - HEADER_HEIGHT,
      };

      /**
       * Push UI to bottom right
       */
      set(persistentTransformAtom, transform);
    }, []),
  );

  return (
    <div
      className={clsx(
        layout === "FLOATING"
          ? "overflow-hidden absolute w-64 h-64 flex z-50 rounded-sm border border-gray-500 shadow-lg"
          : "relative flex-auto flex flex-col",
      )}
      ref={(elem) => {
        setNodeRef(elem);
        containerRef.current = elem;
      }}
      style={
        layout === "FLOATING"
          ? {
              resize: "both",
              transform: CSS.Transform.toString(transform),
              top: persistentTransform.y,
              left: persistentTransform.x,
            }
          : {}
      }
    >
      <div className="flex-auto relative">
        <MapComponent setMap={setMap} />
      </div>
      {layout === "FLOATING" ? null : <Legend />}
      <div
        className="top-2 right-2 absolute
      flex items-center justify-between
      divide-x divide-gray-300 dark:divide-black
      rounded-md border border-gray-300 dark:border-black"
      >
        <T.Root delayDuration={0}>
          <T.Trigger asChild>
            <button
              type="button"
              className={clsx(
                "block p-2 bg-white rounded-l",
                splits.layout === "AUTO" ? SELECTED : UNSELECTED,
              )}
              onClick={() => {
                setSplits((splits) => {
                  return {
                    ...splits,
                    layout: "AUTO",
                  };
                });
              }}
            >
              <LayoutIcon />
            </button>
          </T.Trigger>
          <TContent>
            <StyledTooltipArrow />
            Horizontal layout
          </TContent>
        </T.Root>

        <T.Root delayDuration={0}>
          <T.Trigger asChild>
            <button
              type="button"
              className={clsx(
                "block p-2 bg-white",
                splits.layout === "FLOATING" ? SELECTED : UNSELECTED,
              )}
              onClick={() => {
                switchToFloating();
              }}
            >
              <BoxModelIcon />
            </button>
          </T.Trigger>
          <TContent>
            <StyledTooltipArrow />
            Floating map layout
          </TContent>
        </T.Root>
        <T.Root delayDuration={0}>
          <T.Trigger asChild>
            <button
              type="button"
              className={clsx(
                "block p-2 bg-white rounded-r",
                splits.layout === "VERTICAL" ? SELECTED : UNSELECTED,
              )}
              onClick={() => {
                setSplits((splits) => {
                  return {
                    ...splits,
                    layout: "VERTICAL",
                  };
                });
              }}
            >
              <ViewHorizontalIcon />
            </button>
          </T.Trigger>
          <TContent>
            <StyledTooltipArrow />
            Vertical layout
          </TContent>
        </T.Root>
      </div>
      {layout === "FLOATING" ? (
        <button
          className="absolute top-2 left-2 block p-2
        border border-gray-300 dark:border-black
        bg-white dark:bg-gray-700
        dark:text-white
        rounded
        touch-none
        cursor-move"
          {...listeners}
          {...attributes}
        >
          <MoveIcon />
        </button>
      ) : null}
    </div>
  );
}

function useMapResize(element: HTMLElement | null, _layout: ResolvedLayout) {
  const pmap = useContext(MapContext);

  useLayoutEffect(() => {
    if (element) {
      element.style.width = "";
      element.style.height = "";
    }
    pmap?.map?.resize();
  }, [element, pmap]);

  useLayoutEffect(() => {
    if (element) {
      const callback = debounce((entries: ResizeObserverEntry[]) => {
        if (!Array.isArray(entries)) {
          return;
        }

        if (!entries.length) {
          return;
        }

        pmap?.map?.resize();
      }, 50);

      const resizeObserver = new ResizeObserver(callback);
      resizeObserver.observe(element, { box: "border-box" });
      return () => resizeObserver.unobserve(element);
    } else {
      // Nothing
    }
  }, [element, pmap]);
}
