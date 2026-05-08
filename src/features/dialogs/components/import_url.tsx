import { GlobeIcon } from "@radix-ui/react-icons";
import { Form, Formik } from "formik";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { DialogHeader } from "@/components/dialog";
import { styledInlineA, TextWell } from "@/components/elements";
import { InlineError } from "@/components/inline_error";
import { LabeledTextField } from "@/components/LabeledTextField";
import SimpleDialogActions from "@/features/dialogs/components/simple_dialog_actions";
import { dialogAtom } from "@/stores/dialog_state";
import { MB_TO_BYTES } from "@/utils/constants";

interface UrlValue {
  url: string;
}

const MB_LIMIT = 5;

export function ImportURLDialog({ onClose }: { onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <>
      <DialogHeader title="Import from URL" titleIcon={GlobeIcon} />
      <Formik<UrlValue>
        onSubmit={async function onSubmit({ url }) {
          try {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            if (buffer.byteLength > MB_TO_BYTES * MB_LIMIT) {
              setFormError(
                `Files over ${MB_LIMIT}MB are not supported for URL input.`,
              );
              return;
            }
            setDialogState({
              type: "import",
              files: [
                {
                  type: "file",
                  file: new File([buffer], url.split("/").pop() || "", {
                    type: res.headers.get("Content-Type") || "",
                  }),
                },
              ],
            });
          } catch (_e) {
            setFormError(`Could not load data from that URL.`);
          }
        }}
        initialValues={{
          url: "",
        }}
      >
        <Form>
          <LabeledTextField type="url" label="URL" name="url" />
          <div className="space-y-2">
            {formError && <InlineError>{formError}</InlineError>}
            <TextWell>
              Load data from a URL. URLs must be public and need to support
              CORS.
            </TextWell>
            <TextWell>
              You can use <code>?load=URL</code> to skip this dialog.
            </TextWell>
          </div>
          <SimpleDialogActions onClose={onClose} action="Load" />
        </Form>
      </Formik>
    </>
  );
}
