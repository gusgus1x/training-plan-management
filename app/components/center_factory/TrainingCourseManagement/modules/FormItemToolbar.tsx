"use client";

import styles from "./FormItemToolbar.module.css";

export type FormItemKind = "QUESTION" | "SECTION_BREAK" | "TEXT_BLOCK";

type FormItemToolbarProps = {
  /**
   * Distance in px from the top of the positioned wrapper to the card the strip should sit beside.
   * null pins it to the top, which is what happens when nothing is focused yet.
   */
  anchorTop: number | null;
  onAdd: (kind: FormItemKind) => void;
  disabled?: boolean;
};

// Deliberately knows nothing about questions, drafts, or either module's state shape - it takes a
// pixel offset and emits a kind. That is what lets one component serve both EvaluationManagement
// (DraftQuestion with prompt/options) and Assessment (DraftQuestion with questionText/choices),
// whose draft types have almost nothing in common.
const BUTTONS: ReadonlyArray<{ kind: FormItemKind; glyph: string; label: string }> = [
  { kind: "QUESTION", glyph: "+", label: "Add question" },
  { kind: "SECTION_BREAK", glyph: "≡", label: "Add section" },
  { kind: "TEXT_BLOCK", glyph: "Tt", label: "Add text" },
];

export default function FormItemToolbar({ anchorTop, onAdd, disabled = false }: FormItemToolbarProps) {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Add form item"
      style={{ transform: `translateY(${anchorTop ?? 0}px)` }}
    >
      {BUTTONS.map((button) => (
        <button
          key={button.kind}
          className={styles.button}
          type="button"
          disabled={disabled}
          title={button.label}
          aria-label={button.label}
          onClick={() => onAdd(button.kind)}
        >
          <span aria-hidden="true">{button.glyph}</span>
        </button>
      ))}
    </div>
  );
}
