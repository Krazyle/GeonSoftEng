import {
  ArrowRightIcon,
  CircleIcon,
  ClipboardCopyIcon,
  CommitIcon,
} from "@radix-ui/react-icons";
import { useSetAtom } from "jotai";
import { ContextMenu as CM } from "radix-ui";
import { memo } from "react";
import toast from "react-hot-toast";
import type { IFeature, IWrappedFeature, LineString } from "types";
import {
  CMContent,
  CMItem,
  CMSubContent,
  CMSubTriggerItem,
} from "@/components/elements";
import { GeometryActions } from "@/features/context_actions/components/geometry_actions";
import type { ContextInfo } from "@/features/map/components/map_component";
import { stringifyFeatures } from "@/hooks/use_clipboard";
import {
  continueFeature,
  getContinuationDirection,
} from "@/hooks/use_line_mode";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import { dialogAtom, Mode, modeAtom, selectionAtom } from "@/stores/jotai";
import { usePersistence } from "@/utils/persistence/context";
import { writeToClipboard } from "@/utils/utils";

function _FeatureItem({ feature }: { feature: IWrappedFeature }) {
  const setSelection = useSetAtom(selectionAtom);
  return (
    <CMItem
      onSelect={() => {
        setSelection(USelection.single(feature.id));
      }}
      onFocus={() => {
        setSelection(USelection.single(feature.id));
      }}
      key={feature.id}
    >
      {feature.feature.geometry?.type}
    </CMItem>
  );
}

function getContinuation(contextInfo: ContextInfo) {
  for (const { id, wrappedFeature } of contextInfo.features.ids) {
    const direction = getContinuationDirection(id, wrappedFeature.feature);
    if (direction) {
      return {
        wrappedFeature: wrappedFeature as IWrappedFeature<IFeature<LineString>>,
        direction,
      };
    }
  }
  return null;
}

function MaybeContinue({ contextInfo }: { contextInfo: ContextInfo }) {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const continuation = getContinuation(contextInfo);
  if (!continuation) return null;

  return (
    <CMItem
      onSelect={() => {
        const { wrappedFeature, direction } = continuation;
        const newFeature = continueFeature(wrappedFeature.feature, direction);
        transact({
          note: "Continued a feature",
          putFeatures: [
            {
              ...wrappedFeature,
              feature: newFeature,
            },
          ],
        })
          .then(() => {
            setSelection(USelection.single(wrappedFeature.id));
            setMode({
              mode: Mode.DRAW_LINE,
              modeOptions: { reverse: direction === "reverse" },
            });
          })
          .catch((e) => captureException(e));
      }}
    >
      <CommitIcon />
      Continue line
    </CMItem>
  );
}

export const MapContextMenu = memo(function MapContextMenu({
  contextInfo,
}: {
  contextInfo: ContextInfo | null;
}) {
  const setSelection = useSetAtom(selectionAtom);
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <CM.Portal>
      <CMContent>
        {contextInfo ? (
          <>
            {contextInfo.features.features.length ? (
              <CM.Sub>
                <CMSubTriggerItem>
                  Select
                  <ArrowRightIcon />
                </CMSubTriggerItem>
                <CMSubContent>
                  {contextInfo.features.features.map((feature) => {
                    return (
                      <CM.Sub key={feature.id}>
                        <CMSubTriggerItem>
                          {(feature.feature.properties?.title as string) ||
                            (feature.feature.properties?.name as string) ||
                            feature.feature.geometry?.type}
                        </CMSubTriggerItem>
                        <CMSubContent>
                          <CMItem
                            onSelect={() => {
                              setSelection(USelection.single(feature.id));
                            }}
                          >
                            Select
                          </CMItem>
                          <CMItem
                            onSelect={() => {
                              setDialogState({
                                type: "rename_feature",
                                feature,
                              });
                            }}
                          >
                            Rename
                          </CMItem>
                        </CMSubContent>
                      </CM.Sub>
                    );
                  })}
                </CMSubContent>
              </CM.Sub>
            ) : null}
            {contextInfo.selectedFeatures.length ? (
              <CM.Sub>
                <CMSubTriggerItem>
                  Operations
                  <ArrowRightIcon />
                </CMSubTriggerItem>

                <CMSubContent>
                  <GeometryActions
                    selectedWrappedFeatures={contextInfo.selectedFeatures}
                    as="context-item"
                  />
                </CMSubContent>
                <CMItem
                  onSelect={() => {
                    stringifyFeatures(contextInfo.selectedFeatures).ifJust(
                      ({ data, message }) => {
                        toast
                          .promise(writeToClipboard(data), {
                            loading: "Copying…",
                            error: "Failed to copy",
                            success: message,
                          })
                          .catch((e) => {
                            captureException(e);
                          });
                      },
                    );
                  }}
                >
                  Copy as GeoJSON
                  <ClipboardCopyIcon />
                </CMItem>
              </CM.Sub>
            ) : null}
            <MaybeContinue contextInfo={contextInfo} />
          </>
        ) : null}
        <CMItem
          onSelect={() => {
            if (contextInfo) {
              setDialogState({
                type: "circle",
                position: contextInfo.position,
              });
            }
          }}
        >
          Draw circle here
          <CircleIcon />
        </CMItem>
      </CMContent>
    </CM.Portal>
  );
});
