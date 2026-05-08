import type { IWrappedFeature } from "types";
import { LongitudeLatitudeInputs } from "@/components/longitude_latitude_inputs";
import { PanelDetails } from "@/components/panel_details";
import useResettable from "@/hooks/use_resettable";
import { captureException } from "@/lib/integrations/errors";
import { setCoordinates } from "@/utils/map_operations";
import { getCoordinatesMaybe } from "@/utils/map_operations/get_coordinates";
import { usePersistence } from "@/utils/persistence/context";

export function FeatureEditorVertex({
  wrappedFeature,
  vertexId,
}: {
  wrappedFeature: IWrappedFeature;
  vertexId: VertexId;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();

  const coordinatesMaybe = getCoordinatesMaybe(
    wrappedFeature.feature,
    vertexId,
  );

  const [longitude, latitude] = coordinatesMaybe.orDefault([0, 0]);

  const longitudeProps = useResettable({
    value: longitude.toString(),
    onCommit(newValue) {
      const num = +newValue;
      if (!Number.isNaN(num)) {
        transact({
          putFeatures: [
            {
              ...wrappedFeature,
              feature: setCoordinates({
                breakRectangle: true,
                feature: wrappedFeature.feature,
                position: [num, latitude],
                vertexId: vertexId,
              }).feature,
            },
          ],
        }).catch((e) => captureException(e));
      }
    },
  });
  const latitudeProps = useResettable({
    value: latitude.toString(),
    onCommit(newValue) {
      const num = +newValue;
      if (!Number.isNaN(num)) {
        transact({
          putFeatures: [
            {
              ...wrappedFeature,
              feature: setCoordinates({
                breakRectangle: true,
                feature: wrappedFeature.feature,
                position: [longitude, num],
                vertexId: vertexId,
              }).feature,
            },
          ],
        }).catch((e) => captureException(e));
      }
    },
  });

  if (coordinatesMaybe.isNothing()) {
    return null;
  }

  return (
    <PanelDetails title="Selected vertex">
      <LongitudeLatitudeInputs
        longitudeProps={longitudeProps}
        latitudeProps={latitudeProps}
      />
    </PanelDetails>
  );
}
