import { ClipboardIcon, DownloadIcon } from "@radix-ui/react-icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { z } from "zod";
import { DialogHeader } from "@/components/dialog";
import { styledInlineA, TextWell } from "@/components/elements";
import { useImportString } from "@/hooks/use_import";
import { DEFAULT_IMPORT_OPTIONS } from "@/utils/convert";

const ExampleList = z.array(z.string());

function friendlyName(filename: string): string {
  let string = filename.split(".")[0].replace(/^ne_(\d+)m_/, "");
  string = string
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  string = string.charAt(0).toUpperCase() + string.slice(1);
  return string;
}

export function ImportExampleDialog({ onClose }: { onClose: () => void }) {
  const doImport = useImportString();
  const { data: exampleList } = useSuspenseQuery({
    queryKey: ["import-examples"],
    queryFn: () =>
      fetch("")
        .then((r) => r.json())
        .then((json) => {
          return ExampleList.parse(json);
        }),
  });

  return (
    <>
      <DialogHeader title="Data library" titleIcon={ClipboardIcon} />
      <TextWell>
        The data library includes commonly-used datasets ready to add to your
        map.
      </TextWell>
      <div className="overflow-y-auto app-scrollbar max-h-48 mt-4 border border-gray-200 dark:border-gray-700 rounded-sm">
        <div className="grid gap-1 p-1">
          {exampleList?.map((example) => {
            const nice = friendlyName(example);
            return (
              <button
                type="button"
                className="text-left text-sm group rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 p-1"
                key={example}
                onClick={async () => {
                  await toast.promise(
                    fetch(`${example}`)
                      .then((r) => r.text())
                      .then((geojson) => {
                        return doImport(
                          geojson,
                          {
                            ...DEFAULT_IMPORT_OPTIONS,
                            type: "geojson",
                          },
                          () => {},
                          nice,
                        );
                      }),
                    {
                      loading: "Loading…",
                      success: "Loaded",
                      error: "Error loading from the data library",
                    },
                  );
                  onClose();
                }}
              >
                <DownloadIcon className="inline-flex mr-2" />
                {nice}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
