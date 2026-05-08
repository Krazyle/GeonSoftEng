import { useFormikContext } from "formik";
import { useEffect } from "react";
import { captureException } from "@/lib/integrations/errors";
import {
  DEFAULT_IMPORT_OPTIONS,
  detectType,
  type ImportOptions,
} from "@/utils/convert";

const defaultOptions = {
  type: "geojson",
  toast: true,
  secondary: false,
  ...DEFAULT_IMPORT_OPTIONS,
} as const;

export function AutoDetect({ file }: { file: File }) {
  const { setValues } = useFormikContext<ImportOptions>();

  useEffect(() => {
    detectType(file)
      .then((detected) => {
        return setValues((values) => ({
          ...values,
          ...detected.orDefault(defaultOptions),
        }));
      })
      .catch((e) => captureException(e));
  }, [file, setValues]);
  return null;
}
