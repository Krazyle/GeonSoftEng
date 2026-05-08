import { ClipboardIcon } from "@radix-ui/react-icons";
import * as Comlink from "comlink";
import type { FormikHelpers } from "formik";
import { Form, Formik } from "formik";
import { useState } from "react";
import { CoordinateStringOptionsForm } from "@/components/coordinate_string_options_form";
import { DialogHeader } from "@/components/dialog";
import { StyledFieldTextareaCode } from "@/components/elements";
import { SelectFileType } from "@/components/fields";
import { CsvOptionsForm } from "@/features/csv_options_form";
import SimpleDialogActions from "@/features/dialogs/components/simple_dialog_actions";
import { useImportString } from "@/hooks/use_import";
import { captureException } from "@/lib/integrations/errors";
import type { DialogStateLoadText } from "@/stores/dialog_state";
import type { ImportOptions, Progress } from "@/utils/convert";
import { DEFAULT_IMPORT_OPTIONS } from "@/utils/convert";
import { ImportProgressBar } from "./import/import_progress_bar";

interface ImportOptionsWithText extends ImportOptions {
  text: string;
}

export function ImportTextDialog({
  modal,
  onClose,
}: {
  modal: DialogStateLoadText;
  onClose: () => void;
}) {
  const doImport = useImportString();
  const [progress, setProgress] = useState<Progress | null>(null);

  async function onSubmit(
    values: ImportOptionsWithText,
    helpers: FormikHelpers<ImportOptionsWithText>,
  ) {
    try {
      const { text, ...options } = values;
      (
        await doImport(
          text,
          options,
          Comlink.proxy((newProgress) => {
            setProgress(newProgress);
          }),
        )
      ).caseOf({
        Left(e) {
          helpers.setErrors({
            type: e.message,
          });
        },
        Right() {
          onClose();
        },
      });
    } catch (e: any) {
      captureException(e);
      helpers.setErrors({
        type: e.message,
      });
    }
  }

  return (
    <>
      <DialogHeader title="Import text" titleIcon={ClipboardIcon} />
      <Formik
        onSubmit={onSubmit}
        initialValues={{
          ...DEFAULT_IMPORT_OPTIONS,
          type: "geojson",
          text: modal.initialValue || "",
          toast: true,
        }}
      >
        {({ values }) => (
          <Form>
            <div>
              <div>
                <div className="space-y-4">
                  <StyledFieldTextareaCode
                    aria-label="Data"
                    as="textarea"
                    name="text"
                    autoFocus
                  />
                  <SelectFileType textOnly />
                  <CoordinateStringOptionsForm />
                  <CsvOptionsForm file={values.text} geocoder />
                </div>
              </div>
              <SimpleDialogActions onClose={onClose} action="Import" />
              <ImportProgressBar progress={progress} />
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
}
