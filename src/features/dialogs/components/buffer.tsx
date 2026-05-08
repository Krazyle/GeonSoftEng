import { AllSidesIcon } from "@radix-ui/react-icons";
import { Field, Form, Formik } from "formik";
import { DialogHeader } from "@/components/dialog";
import {
  StyledField,
  StyledLabelSpan,
  styledSelect,
  TextWell,
} from "@/components/elements";
import { UnitOptionsGroups } from "@/components/unit_select";
import SimpleDialogActions from "@/features/dialogs/components/simple_dialog_actions";
import { captureException } from "@/lib/integrations/errors";
import type { DialogStateBuffer } from "@/stores/dialog_state";
import type { BufferOptions } from "@/utils/buffer";
import { GROUPED_UNIT_OPTIONS } from "@/utils/constants";
import { buffer } from "@/utils/map_operations/buffer";
import { usePersistence } from "@/utils/persistence/context";

export default function BufferDialog({
  modal,
  onClose,
}: {
  modal: DialogStateBuffer;
  onClose: () => void;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { features } = modal;

  return (
    <>
      <DialogHeader title="Buffer" titleIcon={AllSidesIcon} />
      <Formik<BufferOptions>
        initialValues={{
          quadrantSegments: 8,
          units: "kilometers",
          radius: 1,
        }}
        onSubmit={async (options) => {
          const putFeatures = await Promise.all(
            features.map(async (wrappedFeature) => {
              return {
                ...wrappedFeature,
                feature: await buffer(wrappedFeature.feature, options),
              };
            }),
          );
          transact({
            note: "Buffered features",
            putFeatures,
            track: [
              "operation-buffer",
              {
                count: features.length,
              },
            ],
          })
            .catch((e) => captureException(e))
            .finally(() => {
              onClose();
            });
        }}
      >
        <Form className="space-y-4">
          <div className="grid grid-cols-3 gap-x-2">
            <label className="block">
              <div>
                <StyledLabelSpan>Radius</StyledLabelSpan>
              </div>
              <StyledField name="radius" className="w-full" type="number" />
            </label>

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
            <label className="block">
              <div>
                <StyledLabelSpan>Segments (detail)</StyledLabelSpan>
              </div>
              <StyledField
                name="quadrantSegments"
                className="w-full"
                type="number"
              />
            </label>
          </div>
          <TextWell>
            Higher detail adds more vertices to the rounded edges of buffered
            shapes, at the cost of larger files.
          </TextWell>
          <div className="flex flex-col sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3">
            <SimpleDialogActions
              variant="xs"
              action="Buffer"
              onClose={onClose}
            />
          </div>
        </Form>
      </Formik>
    </>
  );
}
