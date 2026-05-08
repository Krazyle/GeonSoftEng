import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useSetAtom } from "jotai";
import { memo } from "react";
import { AppIcon, Button } from "@/components/elements";
import { FileInfo } from "@/components/file_info";
import { dialogAtom } from "@/stores/jotai";

export const MenuBarPlay = memo(function MenuBar() {
  return (
    <div className="flex justify-between h-12 pr-2 text-black dark:text-white">
      <div className="flex items-center">
        <span
          className="py-1 pl-1 pr-2
          text-gray-500
          inline-flex gap-x-2 items-center"
          title="Home"
        >
          <AppIcon className="w-8 h-8" />
        </span>
        <FileInfo />
      </div>
      <div className="flex items-center gap-x-2" />
    </div>
  );
});

export function HelpDot() {
  const setDialogState = useSetAtom(dialogAtom);
  return (
    <Button
      variant="quiet"
      onClick={() => {
        setDialogState({ type: "cheatsheet" });
      }}
    >
      Shortcuts
    </Button>
  );
}
