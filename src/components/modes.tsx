import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DropdownMenu as DD } from "radix-ui";
import { memo } from "react";
import type { IWrappedFeature } from "types";
import {
  Button,
  DDContent,
  DDLabel,
  DDSeparator,
  StyledItem,
} from "@/components/elements";
import MenuAction from "@/components/menu_action";
import { useLineMode } from "@/hooks/use_line_mode";
import { USelection } from "@/stores";
import {
  circleTypeAtom,
  dataAtom,
  dialogAtom,
  ephemeralStateAtom,
  MODE_INFO,
  Mode,
  modeAtom,
  routeTypeAtom,
} from "@/stores/jotai";
import { CIRCLE_TYPE, ROUTE_TYPE } from "@/stores/mode";

export function MaterialIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-rounded text-[20px] select-none ${className}`}
      style={{
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
    >
      {name}
    </span>
  );
}

function RouteMenu() {
  const [routeType, setRouteType] = useAtom(routeTypeAtom);
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <div className="z-50">
      <DD.Root>
        <DD.Trigger asChild>
          <Button size="xxs" variant="quiet">
            <MaterialIcon name="arrow_drop_down" />
          </Button>
        </DD.Trigger>
        <DDContent>
          <DDLabel>Route type</DDLabel>
          {[ROUTE_TYPE.DRIVING, ROUTE_TYPE.WALKING, ROUTE_TYPE.CYCLING].map(
            (type) => (
              <StyledItem
                key={type}
                onSelect={() => {
                  setRouteType(type);
                }}
              >
                <MaterialIcon
                  name="check"
                  className={routeType === type ? "" : "opacity-0"}
                />
                {type}
              </StyledItem>
            ),
          )}
          <DDSeparator />
          <StyledItem
            onSelect={() => {
              setDialogState({ type: "route_help" });
            }}
          >
            <MaterialIcon name="help" className="text-[14px]!" />{" "}
            <span className="text-xs">Help</span>
          </StyledItem>
        </DDContent>
      </DD.Root>
    </div>
  );
}

function CircleMenu() {
  const [circleType, setCircleType] = useAtom(circleTypeAtom);
  const setData = useSetAtom(dataAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const setMode = useSetAtom(modeAtom);

  return (
    <div className="z-50">
      <DD.Root>
        <DD.Trigger asChild>
          <Button size="xxs" variant="quiet">
            <MaterialIcon name="arrow_drop_down" />
          </Button>
        </DD.Trigger>
        <DDContent>
          <DDLabel>Circle type</DDLabel>
          {[
            CIRCLE_TYPE.MERCATOR,
            CIRCLE_TYPE.GEODESIC,
            CIRCLE_TYPE.DEGREES,
          ].map((type) => (
            <StyledItem
              key={type}
              onSelect={() => {
                setCircleType(type);
                setEphemeralState({ type: "none" });
                setData((data) => {
                  return {
                    ...data,
                    selection: USelection.selectionToFolder(data),
                  };
                });
                setMode({
                  mode: Mode.DRAW_CIRCLE,
                  modeOptions: {
                    multi: false,
                    replaceGeometryForId: null,
                    circleType: type,
                  },
                });
              }}
            >
              <MaterialIcon
                name="check"
                className={circleType === type ? "" : "opacity-0"}
              />
              {type}
            </StyledItem>
          ))}
          <DDSeparator />
          <StyledItem
            onSelect={() => {
              setDialogState({ type: "circle_types" });
            }}
          >
            <MaterialIcon name="help" className="text-[14px]!" />{" "}
            <span className="text-xs">Help</span>
          </StyledItem>
        </DDContent>
      </DD.Root>
    </div>
  );
}

const MODE_OPTIONS = [
  {
    mode: Mode.NONE,
    hotkey: "1",
    Icon: () => <MaterialIcon name="near_me" />,
    Menu: null,
  },
  {
    mode: Mode.DRAW_POINT,
    hotkey: "2",
    Icon: () => <MaterialIcon name="location_on" />,
    Menu: null,
  },
  {
    mode: Mode.DRAW_LINE,
    hotkey: "3",
    Icon: () => <MaterialIcon name="show_chart" />,
    Menu: null,
  },
  {
    mode: Mode.DRAW_POLYGON,
    hotkey: "4",
    Icon: () => <MaterialIcon name="polyline" />,
    Menu: null,
  },
  {
    mode: Mode.DRAW_RECTANGLE,
    hotkey: "5",
    Icon: () => <MaterialIcon name="rectangle" />,
    Menu: null,
  },
  {
    mode: Mode.DRAW_CIRCLE,
    hotkey: "6",
    Icon: () => <MaterialIcon name="circle" />,
    Menu: CircleMenu,
  },
  {
    mode: Mode.DRAW_ROUTE,
    hotkey: "7",
    Icon: () => <MaterialIcon name="directions_car" />,
    Menu: RouteMenu,
  },
] as const;

export default memo(function Modes({
  replaceGeometryForId,
}: {
  replaceGeometryForId: IWrappedFeature["id"] | null;
}) {
  const [{ mode: currentMode, modeOptions }, setMode] = useAtom(modeAtom);
  const setData = useSetAtom(dataAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const lineMode = useLineMode();
  const circleType = useAtomValue(circleTypeAtom);

  return (
    <div className="flex items-center justify-start gap-x-3" role="radiogroup">
      {MODE_OPTIONS.filter((mode) => {
        if (!replaceGeometryForId) return true;
        return mode.mode !== Mode.NONE;
      }).map(({ mode, hotkey, Icon, Menu }, i) => {
        const menuAction = (
          <MenuAction
            role="radio"
            key={i}
            selected={currentMode === mode}
            hotkey={hotkey}
            label={MODE_INFO[mode].label}
            onClick={(e) => {
              if (mode === Mode.DRAW_LINE) {
                void lineMode({
                  event: e,
                  replaceGeometryForId,
                });
              } else {
                setEphemeralState({ type: "none" });
                setData((data) => {
                  return {
                    ...data,
                    selection: USelection.selectionToFolder(data),
                  };
                });
                setMode({
                  mode,
                  modeOptions: {
                    multi: !!e?.shiftKey,
                    replaceGeometryForId,
                    circleType,
                  },
                });
              }
            }}
          >
            <Icon />
            {currentMode === mode && modeOptions?.multi ? (
              <MaterialIcon
                name="add"
                className="text-[10px]! absolute bottom-1 right-1 font-bold"
              />
            ) : null}
          </MenuAction>
        );
        return Menu ? (
          <div key={mode} className="flex items-center">
            {menuAction}
            {<Menu />}
          </div>
        ) : (
          menuAction
        );
      })}
    </div>
  );
});
