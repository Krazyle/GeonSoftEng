import { useAtomValue } from "jotai";
import { DropdownMenu as DD, Popover as P, Tooltip as T } from "radix-ui";
import type React from "react";
import * as E from "@/components/elements";
import { ShapeUnite16 } from "@/components/icons";
import { MaterialIcon } from "@/components/modes";
import { GeometryActions } from "@/features/context_actions/components/geometry_actions";
import { MultiActions } from "@/features/context_actions/components/multi_actions";
import { FeatureEditorGeometry } from "@/features/panels/components/feature_editor/feature_editor_geometry";
import { selectedFeaturesAtom } from "@/stores/jotai";
import { pluralize } from "@/utils/utils";

export function ToolbarTrigger({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof T.Trigger>) {
  return (
    <div
      className="h-10 w-12 p-1
          group bn
          flex items-stretch justify-center focus:outline-hidden"
    >
      <T.Trigger asChild {...props}>
        <DD.Trigger asChild>
          <E.Button variant="quiet">
            {children}
            <MaterialIcon name="arrow_drop_down" />
          </E.Button>
        </DD.Trigger>
      </T.Trigger>
    </div>
  );
}

export default function ContextActions() {
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);

  if (selectedWrappedFeatures.length === 0) return null;

  return (
    <div className="flex items-center">
      <div className="h-12 self-stretch flex items-center text-sm font-medium pr-4 text-purple-700 dark:text-purple-300">
        {selectedWrappedFeatures.length === 1
          ? (selectedWrappedFeatures[0].feature.properties?.title as string) ||
            (selectedWrappedFeatures[0].feature.properties?.name as string) ||
            selectedWrappedFeatures[0].feature.geometry?.type
          : `${pluralize("feature", selectedWrappedFeatures.length)} selected`}
      </div>
      {selectedWrappedFeatures.length > 1 ? (
        <DD.Root>
          <T.Root>
            <ToolbarTrigger aria-label="Operations">
              <ShapeUnite16 />
            </ToolbarTrigger>
            <E.TContent>
              <E.StyledTooltipArrow />
              <div className="whitespace-nowrap">Union features</div>
            </E.TContent>
          </T.Root>
          <E.DDContent align="start">
            <MultiActions
              selectedWrappedFeatures={selectedWrappedFeatures}
              as="dropdown-item"
            />
          </E.DDContent>
        </DD.Root>
      ) : null}
      <GeometryActions
        selectedWrappedFeatures={selectedWrappedFeatures}
        as="root"
      />
      <T.Root>
        <P.Root>
          <T.Trigger asChild>
            <div
              className="h-10 w-10 p-1
                  group bn
                  flex items-stretch justify-center focus:outline-hidden"
            >
              <P.Trigger asChild aria-label="Measurements">
                <E.Button variant="quiet">
                  <MaterialIcon name="straighten" />
                </E.Button>
              </P.Trigger>
            </div>
          </T.Trigger>
          <E.TContent side="bottom">
            <E.StyledTooltipArrow />
            <div className="whitespace-nowrap">Geometry information</div>
          </E.TContent>
          <E.PopoverContent2 size="md">
            <div className="relative">
              <P.Close
                aria-label="Close"
                className="absolute top-0 right-1 dark:text-white"
              >
                <MaterialIcon name="close" />
              </P.Close>
              <div className="pt-4">
                <FeatureEditorGeometry
                  wrappedFeatures={selectedWrappedFeatures}
                />
              </div>
            </div>
          </E.PopoverContent2>
        </P.Root>
      </T.Root>
    </div>
  );
}
