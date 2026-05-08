import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "@/components/dialog";
import { Button } from "@/components/elements";
import type { DialogStateImportNotes } from "@/stores/dialog_state";
import { pluralize } from "@/utils/utils";

export function ImportNotesDialog({
  modal,
  onClose,
}: {
  modal: DialogStateImportNotes;
  onClose: () => void;
}) {
  const {
    result: { notes },
  } = modal;

  return (
    <>
      <DialogHeader
        title={`${pluralize("issue", notes.length)} detected on import`}
        titleIcon={ExclamationTriangleIcon}
      />
      <div className="max-h-48 overflow-y-auto text-sm">
        {notes.map((note, i) => {
          return <div key={i}>{note}</div>;
        })}
      </div>
      <div className="pt-6 pb-1 flex flex-col sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3">
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}
