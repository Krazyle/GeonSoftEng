import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorState, Transaction } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import isEqual from "lodash/isEqual";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, IWrappedFeature } from "types";
import { captureException } from "@/lib/integrations/errors";
import { appTheme } from "@/utils/codemirror_theme";
import { usePersistence } from "@/utils/persistence/context";
import { lib } from "@/utils/worker";

const checker = linter((view) => {
  return lib.getIssues(view.state.doc.toString());
});

function hasImportantChange(view: ViewUpdate): boolean {
  return (
    view.docChanged &&
    view.transactions.some((t) => t.annotation(Transaction.userEvent))
  );
}

export const FeatureText = memo(function FeatureText({
  feature,
}: {
  feature: IWrappedFeature;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { at, id, folderId } = feature;
  const [editor, setEditor] = useState<EditorView | null>(null);
  const mountPointRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorView | null>(null);
  const localValue = useRef<Feature | null>(null);

  const onChanges = useMemo(
    () =>
      EditorView.updateListener.of((view) => {
        if (!hasImportantChange(view)) {
          return;
        }

        const docStr = view.state.doc.toString();
        lib
          .getIssues(docStr)
          .then((issues: any[]) => {
            if (issues.length > 0) {
              return;
            }

            const sent = JSON.parse(docStr);
            localValue.current = sent;
            return transact({
              note: "Updated a property value",
              putFeatures: [
                {
                  at: at,
                  id: id,
                  folderId: folderId,
                  feature: sent,
                },
              ],
            });
          })
          .catch((e: any) => captureException(e));
      }),
    [at, id, folderId, transact],
  );

  useEffect(() => {
    let instance: EditorView;

    if (!editorRef.current && window && mountPointRef.current) {
      instance = new EditorView({
        state: EditorState.create({
          doc: JSON.stringify(feature, null, 2),
          extensions: [
            keymap.of([...defaultKeymap, ...historyKeymap]),
            history(),
            drawSelection(),
            appTheme,
            json(),
            checker,
            onChanges,
          ],
        }),
        parent: mountPointRef.current,
      });
      editorRef.current = instance;
      setEditor(instance);
    }
    return () => {};
  }, [feature, onChanges]);

  useEffect(() => {
    if (!editor || !window) {
      return;
    }

    const overrideValue = () => {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: JSON.stringify(feature.feature, null, 2),
        },
      });
      localValue.current = feature.feature;
    };

    try {
      if (localValue.current === feature.feature) {
        return;
      }
      const editorValue = editor.state.doc.toString();
      const jsonValue = JSON.parse(editorValue);
      if (isEqual(feature.feature, jsonValue)) {
        return;
      }
      overrideValue();
    } catch (_e) {
      const editorValue = editor.state.doc.toString();
      if (editorValue.trim() === "") {
        overrideValue();
      }
    }
  }, [editor, feature]);

  return <div className="flex-auto" ref={mountPointRef} />;
});
