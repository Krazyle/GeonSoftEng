import { Field, Form, Formik } from "formik";
import { useAtom } from "jotai";
import { DialogHeader } from "@/components/dialog";
import { FieldCheckbox, StyledLabelSpan } from "@/components/elements";
import Line from "@/components/icons/line";
import SimpleDialogActions from "@/features/dialogs/components/simple_dialog_actions";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import type { DialogStateSimplify } from "@/stores/dialog_state";
import { selectionAtom } from "@/stores/jotai";
import { getExtent } from "@/utils/geometry";
import { simplify } from "@/utils/map_operations/simplify";
import { usePersistence } from "@/utils/persistence/context";

export default function SimplifyDialog({
  modal,
  onClose,
}: {
  modal: DialogStateSimplify;
  onClose: () => void;
}) {
  const [selection, setSelection] = useAtom(selectionAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const { features } = modal;

  const maxTolerance = getExtent(features)
    .map((extent) => {
      return (
        Math.max(
          Math.abs(extent[0] - extent[2]),
          Math.abs(extent[1] - extent[3]),
        ) / 8
      );
    })
    .orDefault(2);

  return (
    <>
      <DialogHeader title="Simplify" titleIcon={Line} />
      <Formik
        initialValues={{
          tolerance: maxTolerance / 20,
          highQuality: true,
        }}
        onSubmit={(options) => {
          const putFeatures = features.map((wrappedFeature) => {
            return {
              ...wrappedFeature,
              feature: simplify(wrappedFeature.feature, options),
            };
          });

          if (selection.type === "single" && selection.parts.length) {
            setSelection(USelection.single(selection.id));
          }

          transact({
            note: "Simplified features",
            track: [
              "operation-simplify",
              {
                count: features.length,
              },
            ],
            putFeatures,
          })
            .catch((e) => captureException(e))
            .finally(() => {
              onClose();
            });
        }}
      >
        <Form className="space-y-4">
          <label className="flex items-center gap-x-2">
            <FieldCheckbox name="highQuality" type="checkbox" />
            <StyledLabelSpan>High quality</StyledLabelSpan>
          </label>
          <label className="block">
            <div>
              <StyledLabelSpan>
                Tolerance (degrees, higher values simplify more)
              </StyledLabelSpan>
            </div>
            <Field
              name="tolerance"
              className="w-full"
              type="range"
              min="0"
              step={maxTolerance / 100}
              max={maxTolerance}
            />
          </label>
          <div className="flex flex-col sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3">
            <SimpleDialogActions
              variant="xs"
              action="Simplify"
              onClose={onClose}
            />
          </div>
        </Form>
      </Formik>
    </>
  );
}
