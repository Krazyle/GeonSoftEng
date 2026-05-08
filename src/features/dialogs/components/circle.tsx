import { CircleIcon } from "@radix-ui/react-icons";
import { convertLength, type Units } from "@turf/helpers";
import { Field, Form, Formik } from "formik";
import { useSetAtom } from "jotai";
import { DialogHeader } from "@/components/dialog";
import {
  Hint,
  StyledField,
  StyledLabelSpan,
  styledInlineA,
  styledSelect,
} from "@/components/elements";
import { UnitOptionsGroups } from "@/components/unit_select";
import SimpleDialogActions from "@/features/dialogs/components/simple_dialog_actions";
import { useZoomTo } from "@/hooks/use_zoom_to";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import { type DialogStateCircle, dialogAtom } from "@/stores/dialog_state";
import { CIRCLE_TYPE } from "@/stores/mode";
import { type ICircleProp, makeCircleNative } from "@/utils/circle";
import { GROUPED_UNIT_OPTIONS } from "@/utils/constants";
import { newFeatureId } from "@/utils/id";
import { usePersistence } from "@/utils/persistence/context";

export function CircleDialog({
  modal,
  onClose,
}: {
  modal: DialogStateCircle;
  onClose: () => void;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { position } = modal;
  const zoomTo = useZoomTo();
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <>
      <DialogHeader title="Circle" titleIcon={CircleIcon} />
      <Formik
        initialValues={{
          units: "meters" as Units,
          type: CIRCLE_TYPE.GEODESIC,
          radius: 1,
        }}
        onSubmit={async (values) => {
          const properties: ICircleProp = {
            "@circle": {
              type: values.type,
              center: position,
            },
          };
          const id = newFeatureId();

          const geometry = makeCircleNative({
            center: position,
            value:
              values.type === CIRCLE_TYPE.GEODESIC
                ? convertLength(values.radius, values.units, "radians")
                : values.radius,
            type: values.type,
          });

          await transact({
            note: "Drew a feature",
            putFeatures: [
              {
                id,
                folderId: null,
                feature: {
                  type: "Feature",

                  properties: properties as any,
                  geometry,
                },
              },
            ],
            track: "create-circle-dialog",
          })
            .catch((e) => captureException(e))
            .then(() => {
              return zoomTo(USelection.single(id));
            })
            .finally(() => {
              onClose();
            });
        }}
      >
        {({ values }) => {
          return (
            <Form className="space-y-4">
              <div className="grid grid-cols-3 gap-x-2">
                <label className="block">
                  <div>
                    <StyledLabelSpan>
                      Type
                      <span className="w-2 inline-flex"></span>
                      <Hint>
                        Geodesic circles have a real-world radius. Mercator
                        circles look like circles on the map. Degrees circles
                        have a radius in decimal degrees.
                        <span
                          onClick={() => {
                            setDialogState({ type: "circle_types" });
                          }}
                          className={styledInlineA}
                        >
                          More documentation.
                        </span>
                      </Hint>
                    </StyledLabelSpan>
                  </div>
                  <Field
                    as="select"
                    name="type"
                    className={`${styledSelect({ size: "sm" })} w-full`}
                  >
                    {Object.values(CIRCLE_TYPE).map((type) => {
                      return (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      );
                    })}
                  </Field>
                </label>
                <label className="block">
                  <div>
                    <StyledLabelSpan>Radius</StyledLabelSpan>
                  </div>
                  <StyledField name="radius" className="w-full" type="number" />
                </label>

                {values.type === CIRCLE_TYPE.DEGREES ? (
                  <div className="pt-7 text-sm">Decimal degrees</div>
                ) : values.type === CIRCLE_TYPE.MERCATOR ? (
                  <div className="pt-7 text-sm">Mercator meters</div>
                ) : (
                  <label className="block">
                    <div>
                      <StyledLabelSpan>Units</StyledLabelSpan>
                    </div>
                    <Field
                      as="select"
                      name="units"
                      className={`${styledSelect({ size: "sm" })} w-full`}
                    >
                      <UnitOptionsGroups groups={GROUPED_UNIT_OPTIONS.length} />
                    </Field>
                  </label>
                )}
              </div>
              <div className="flex flex-col sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3">
                <SimpleDialogActions
                  variant="xs"
                  action="Draw circle"
                  onClose={onClose}
                />
              </div>
            </Form>
          );
        }}
      </Formik>
    </>
  );
}
