import { Form, Formik } from "formik";
import { Button, StyledField, StyledLabelSpan } from "@/components/elements";
import { captureException } from "@/lib/integrations/errors";
import type { DialogStateRenameFeature } from "@/stores/dialog_state";
import { updatePropertyValue } from "@/utils/map_operations/update_property_value";
import { usePersistence } from "@/utils/persistence/context";

export function RenameFeatureDialog({
  modal,
  onClose,
}: {
  modal: DialogStateRenameFeature;
  onClose: () => void;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { feature } = modal.feature;
  const initialName = (feature.properties?.title ||
    feature.properties?.name ||
    "") as string;

  return (
    <div className="flex flex-col gap-y-4 p-2">
      <StyledLabelSpan className="text-lg font-bold">
        Rename Feature
      </StyledLabelSpan>
      <Formik
        initialValues={{ name: initialName }}
        onSubmit={async (values) => {
          const newFeature = updatePropertyValue(feature, {
            key: "title",
            value: values.name,
          });
          await transact({
            putFeatures: [
              {
                ...modal.feature,
                feature: newFeature,
              },
            ],
          }).catch((e) => captureException(e));
          onClose();
        }}
      >
        <Form className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-1">
              Title Metadata
            </label>
            <StyledField
              name="name"
              autoFocus
              placeholder="Enter feature name..."
              className="rounded-xl!"
            />
          </div>
          <div className="flex justify-end gap-x-2">
            <Button variant="quiet" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </Form>
      </Formik>
    </div>
  );
}
