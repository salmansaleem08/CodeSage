import type * as Monaco from "monaco-editor";

/** Registers ghost-text hints (same interaction family as inline suggestions). Dispose when unmounting or switching modes. */
export function registerSeedInlineHintProvider(
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor,
  getInsertText: () => string | null,
  onAccepted?: () => void
): Monaco.IDisposable {
  const acceptCommandId = onAccepted ? editor.addCommand(0, () => onAccepted()) : null;

  const providerDisposable = monaco.languages.registerInlineCompletionsProvider(["cpp", "python"], {
    provideInlineCompletions: async (model, position, context, token) => {
      if (token.isCancellationRequested) return undefined;

      const text = getInsertText();
      if (!text) {
        return { items: [] };
      }

      const beforeCursor = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const pad = beforeCursor.trimEnd().length === 0 ? "" : " ";
      const insertText = `${pad}${text}`;

      const item: Monaco.languages.InlineCompletion = {
        insertText,
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        ...(acceptCommandId
          ? {
              command: {
                id: acceptCommandId,
                title: "Continue guided step",
                tooltip: "Continue guided step"
              }
            }
          : {})
      };

      return { items: [item] };
    },
    disposeInlineCompletions() {
      // no-op: list lifetime is managed by the editor
    }
  });

  return {
    dispose() {
      providerDisposable.dispose();
    }
  };
}

export function triggerInlineSuggest(editor: Monaco.editor.IStandaloneCodeEditor): void {
  editor.trigger("", "editor.action.inlineSuggest.trigger", {});
}
