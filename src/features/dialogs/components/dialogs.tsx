import { useAtom } from "jotai";
import { Dialog as D } from "radix-ui";
import { memo, Suspense, useCallback } from "react";
import { match } from "ts-pattern";
import {
  type B3Size,
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogOverlay,
} from "@/components/elements";
import BufferDialog from "@/features/dialogs/components/buffer";
import { CastPropertyDialog } from "@/features/dialogs/components/cast_property";
import { CheatsheetDialog } from "@/features/dialogs/components/cheatsheet";
import { CircleDialog } from "@/features/dialogs/components/circle";
import { CircleTypesDialog } from "@/features/dialogs/components/circle_types";
import { ExportDialog } from "@/features/dialogs/components/export";
import { ExportCodeDialog } from "@/features/dialogs/components/export_code";
import { ExportSVGDialog } from "@/features/dialogs/components/export_svg";
import { ImportDialog } from "@/features/dialogs/components/import";
import { ImportExampleDialog } from "@/features/dialogs/components/import_example";
import { ImportNotesDialog } from "@/features/dialogs/components/import_notes";
import { ImportTextDialog } from "@/features/dialogs/components/import_text";
import { ImportURLDialog } from "@/features/dialogs/components/import_url";
import { QuickswitcherDialog } from "@/features/dialogs/components/quickswitcher";
import { RenameFeatureDialog } from "@/features/dialogs/components/rename_feature";
import { RouteHelpDialog } from "@/features/dialogs/components/route_help";
import SimplifyDialog from "@/features/dialogs/components/simplify";
import { dialogAtom } from "@/stores/jotai";

export const Dialogs = memo(function Dialogs() {
  const [dialog, setDialogState] = useAtom(dialogAtom);

  const onClose = useCallback(() => {
    setDialogState(null);
  }, [setDialogState]);

  let dialogSize: B3Size = "sm";

  const content = match(dialog)
    .with(null, () => null)
    .with({ type: "import" }, (modal) => (
      <ImportDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "import_notes" }, (modal) => (
      <ImportNotesDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "export" }, () => <ExportDialog onClose={onClose} />)
    .with({ type: "quickswitcher" }, () => {
      dialogSize = "xs";
      return <QuickswitcherDialog onClose={onClose} />;
    })
    .with({ type: "export_code" }, () => <ExportCodeDialog onClose={onClose} />)
    .with({ type: "load_text" }, (modal) => (
      <ImportTextDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "cast_property" }, (modal) => (
      <CastPropertyDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "cheatsheet" }, () => <CheatsheetDialog />)
    .with({ type: "circle_types" }, () => <CircleTypesDialog />)
    .with({ type: "route_help" }, () => <RouteHelpDialog />)
    .with({ type: "circle" }, (modal) => (
      <CircleDialog modal={modal} onClose={onClose} />
    ))
    .with({ type: "simplify" }, (modal) => (
      <SimplifyDialog onClose={onClose} modal={modal} />
    ))
    .with({ type: "buffer" }, (modal) => (
      <BufferDialog onClose={onClose} modal={modal} />
    ))
    .with({ type: "export-svg" }, () => <ExportSVGDialog />)
    .with({ type: "from_url" }, () => <ImportURLDialog onClose={onClose} />)
    .with({ type: "import_example" }, () => (
      <ImportExampleDialog onClose={onClose} />
    ))
    .with({ type: "rename_feature" }, (modal) => (
      <RenameFeatureDialog modal={modal} onClose={onClose} />
    ))
    .exhaustive();

  return (
    <D.Root
      open={!!content}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      {}
      <D.Trigger className="hidden">
        <div className="hidden"></div>
      </D.Trigger>
      <D.Portal>
        {dialog?.type !== "circle" ? <StyledDialogOverlay /> : null}
        <Suspense fallback={<Loading />}>
          <StyledDialogContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            size={dialogSize}
          >
            <DefaultErrorBoundary>{content}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </D.Portal>
    </D.Root>
  );
});
