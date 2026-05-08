import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { captureException } from "@/lib/integrations/errors";
import { dialogAtom } from "@/stores/jotai";
import { groupFiles } from "@/utils/group_files";

export function useOpenFiles() {
  const setDialogState = useSetAtom(dialogAtom);

  const { data: fsAccess } = useQuery({
    queryKey: ["browser-fs-access"],
    queryFn: async () => {
      return import("browser-fs-access");
    },
  });

  return useCallback(() => {
    if (!fsAccess) throw new Error("Sorry, still loading");
    return fsAccess
      .fileOpen({ multiple: true, description: "Open files…" })
      .then((f) => {
        const files = groupFiles(f);
        setDialogState({
          type: "import",
          files,
        });
      })
      .catch((e) => {
        captureException(e);
      });
  }, [setDialogState, fsAccess]);
}
