import { useSetAtom } from "jotai";
import toast from "react-hot-toast";
import useFileSave from "@/hooks/use_file_save";
import { useMapKeybindings } from "@/hooks/use_map_keybindings";
import { useOpenFiles } from "@/hooks/use_open_files";
import { captureException } from "@/lib/integrations/errors";
import { useHotkeys } from "@/lib/integrations/hotkeys";
import { dialogAtom } from "@/stores/jotai";

export function Keybindings() {
  const setDialogState = useSetAtom(dialogAtom);
  const saveNative = useFileSave();
  const openFiles = useOpenFiles();

  useMapKeybindings();

  useHotkeys(
    "/",
    (e) => {
      e.preventDefault();
      setDialogState({ type: "quickswitcher" });
    },
    [setDialogState],
  );

  useHotkeys(
    "meta+k, Ctrl+k",
    (e) => {
      e.preventDefault();
      setDialogState({ type: "quickswitcher" });
    },
    [setDialogState],
  );

  useHotkeys(
    "meta+shift+s, Ctrl+shift+s",
    (e) => {
      e.preventDefault();
      setDialogState({
        type: "export",
      });
    },
    [setDialogState],
  );

  useHotkeys(
    "Shift+/",
    (e) => {
      e.preventDefault();
      setDialogState((modalState) => {
        if (modalState) return modalState;
        return {
          type: "cheatsheet",
        };
      });
    },
    [setDialogState],
  );

  useHotkeys(
    "meta+s, Ctrl+s",
    (e) => {
      e.preventDefault();
      (async () => {
        const either = await saveNative();
        return either
          .ifLeft((error) => toast.error(error?.message || "Could not save"))
          .map((saved) => {
            if (saved) return;
            setDialogState({
              type: "export",
            });
          });
      })().catch((e) => captureException(e));
    },
    [setDialogState, saveNative],
  );

  useHotkeys(
    "meta+o, Ctrl+o",
    (e) => {
      e.preventDefault();
      openFiles().catch((e) => captureException(e));
    },
    [openFiles],
  );

  return null;
}
