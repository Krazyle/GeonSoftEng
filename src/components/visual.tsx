import { useSetAtom } from "jotai";
import { Popover, Tooltip as T } from "radix-ui";
import { memo, Suspense } from "react";
import * as E from "@/components/elements";
import SvgGemini from "@/components/icons/gemini";
import { SEARCH_KEYBINDING } from "@/features/dialogs/components/cheatsheet";
import { useGeoAgentOpen } from "@/features/geoagent/components/geoagent_chat";
import { LayersPopover } from "@/features/layers/components/popover";
import { dialogAtom } from "@/stores/jotai";
import { getIsMac, localizeKeybinding } from "@/utils/utils";
import { MaterialIcon } from "./modes";

export const Visual = memo(function Visual() {
  const setDialogState = useSetAtom(dialogAtom);
  const isMac = getIsMac();
  const { open, toggle } = useGeoAgentOpen();
  return (
    <div className="flex items-center gap-x-3">
      <div className="h-10 w-10 p-1 flex items-stretch">
        <T.Root>
          <T.Trigger asChild>
            <E.Button
              variant="quiet"
              aria-label="Search"
              onClick={() => {
                setDialogState({ type: "quickswitcher" });
              }}
            >
              <MaterialIcon name="search" />
            </E.Button>
          </T.Trigger>
          <E.TContent>
            <div className="flex items-center gap-x-2">
              Search{" "}
              <E.Keycap>
                {localizeKeybinding(SEARCH_KEYBINDING, isMac)}
              </E.Keycap>
            </div>
          </E.TContent>
        </T.Root>
      </div>

      <T.Root>
        <Popover.Root>
          <div className="h-10 w-10 p-1 flex items-stretch">
            <T.Trigger asChild>
              <Popover.Trigger aria-label="Layers" asChild>
                <E.Button variant="quiet">
                  <MaterialIcon name="layers" />
                </E.Button>
              </Popover.Trigger>
            </T.Trigger>
          </div>
          <E.PopoverContent2 size="md">
            <Suspense fallback={<E.Loading size="sm" />}>
              <LayersPopover />
            </Suspense>
          </E.PopoverContent2>
        </Popover.Root>
        <E.TContent side="bottom">
          <span className="whitespace-nowrap">Manage background layers</span>
        </E.TContent>
      </T.Root>

      <T.Root>
        <T.Trigger asChild>
          <div className="h-10 w-10 p-1 flex items-stretch">
            <E.Button
              variant={open ? "default" : "quiet"}
              aria-label="GeoAgent AI"
              onClick={toggle}
            >
              <SvgGemini className="w-5 h-5" />
            </E.Button>
          </div>
        </T.Trigger>
        <E.TContent side="bottom">
          <span className="whitespace-nowrap">
            {open ? "Close" : "Open"} AI assistant
          </span>
        </E.TContent>
      </T.Root>
    </div>
  );
});
