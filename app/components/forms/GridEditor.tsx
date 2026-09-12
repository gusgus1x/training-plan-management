"use client";

import { Plus, X } from "../icons/LucideIcons";
import { localId, type DraftItem, type DraftOption } from "./formDraft";
import styles from "./FormBuilder.module.css";

/**
 * The rows and columns of a grid question, and - on an assessment - which cell of each row is
 * right.
 *
 * Both axes live in the same `options` list, told apart by `axis`, which is how they are stored:
 * ordering and the per-question unique constraint go on working untouched. This component is the
 * only place that shape has to be understood.
 *
 * Marking is per row, not per grid. A row carries its own points and its own correct column(s), and
 * earns them only on an exact match - the rule `isGridRowCorrect` applies when the answers come
 * back. A row left unmarked can never score, which is what stops an unfinished grid handing out
 * free marks.
 */

const isRow = (option: DraftOption) => option.axis === "ROW";
const isColumn = (option: DraftOption) => option.axis === "COLUMN";

export default function GridEditor({
  item,
  isAssessment,
  onChange,
}: {
  item: DraftItem;
  isAssessment: boolean;
  onChange: (change: (current: DraftItem) => DraftItem) => void;
}) {
  const rows = item.options.filter(isRow);
  const columns = item.options.filter(isColumn);
  const oneColumnPerRow = item.type === "MULTIPLE_CHOICE_GRID";

  const editOption = (optionId: string, change: (option: DraftOption) => DraftOption) =>
    onChange((current) => ({
      ...current,
      options: current.options.map((option) => (option.id === optionId ? change(option) : option)),
    }));

  const addOption = (axis: "ROW" | "COLUMN") =>
    onChange((current) => ({
      ...current,
      options: [
        ...current.options,
        {
          id: localId("opt"),
          text: axis === "ROW" ? `แถวที่ ${rows.length + 1}` : `คอลัมน์ที่ ${columns.length + 1}`,
          isCorrect: false,
          axis,
          nextSection: null,
          score: axis === "ROW" ? "1" : "0",
          correctColumnOrders: [],
        },
      ],
    }));

  /**
   * Removing a column shifts the ones after it, and the answer key is written as positions rather
   * than ids - so every row's key has to be renumbered here or it silently points at the wrong
   * cell.
   */
  const removeOption = (optionId: string) =>
    onChange((current) => {
      const target = current.options.find((option) => option.id === optionId);
      const remaining = current.options.filter((option) => option.id !== optionId);
      if (!target || !isColumn(target)) return { ...current, options: remaining };

      const removedPosition = current.options.filter(isColumn).findIndex((option) => option.id === optionId) + 1;
      return {
        ...current,
        options: remaining.map((option) =>
          isRow(option)
            ? {
                ...option,
                correctColumnOrders: option.correctColumnOrders
                  .filter((order) => order !== removedPosition)
                  .map((order) => (order > removedPosition ? order - 1 : order)),
              }
            : option,
        ),
      };
    });

  const toggleCorrect = (rowId: string, position: number, checked: boolean) =>
    editOption(rowId, (row) => ({
      ...row,
      correctColumnOrders: oneColumnPerRow
        ? checked
          ? [position]
          : []
        : checked
          ? [...row.correctColumnOrders, position]
          : row.correctColumnOrders.filter((order) => order !== position),
    }));

  return (
    <div className={styles.grid}>
      <div className={styles.gridAxes}>
        <div>
          <p className={styles.gridAxisTitle}>แถว</p>
          {rows.map((row) => (
            <div className={styles.gridAxisRow} key={row.id}>
              <input
                className={styles.optionText}
                value={row.text}
                onChange={(event) => editOption(row.id, (current) => ({ ...current, text: event.target.value }))}
              />
              {isAssessment ? (
                <input
                  className={styles.gridScore}
                  value={row.score}
                  title="คะแนนของแถวนี้"
                  onChange={(event) => editOption(row.id, (current) => ({ ...current, score: event.target.value }))}
                />
              ) : null}
              <button type="button" className={styles.iconOnly} title="ลบแถว" onClick={() => removeOption(row.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className={styles.addOption} onClick={() => addOption("ROW")}>
            <Plus size={14} /> เพิ่มแถว
          </button>
        </div>

        <div>
          <p className={styles.gridAxisTitle}>คอลัมน์</p>
          {columns.map((column) => (
            <div className={styles.gridAxisRow} key={column.id}>
              <input
                className={styles.optionText}
                value={column.text}
                onChange={(event) =>
                  editOption(column.id, (current) => ({ ...current, text: event.target.value }))
                }
              />
              <button
                type="button"
                className={styles.iconOnly}
                title="ลบคอลัมน์"
                onClick={() => removeOption(column.id)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className={styles.addOption} onClick={() => addOption("COLUMN")}>
            <Plus size={14} /> เพิ่มคอลัมน์
          </button>
        </div>
      </div>

      {/* The answer key, as the table it describes. An evaluation has no right answer, so it gets
          no table to tick. */}
      {isAssessment && rows.length > 0 && columns.length > 0 ? (
        <div className={styles.gridKeyScroll}>
          <p className={styles.gridAxisTitle}>เฉลย {oneColumnPerRow ? "(แถวละ 1 คอลัมน์)" : "(เลือกได้หลายคอลัมน์)"}</p>
          <table className={styles.gridKeyTable}>
            <thead>
              <tr>
                <th />
                {columns.map((column) => (
                  <th key={column.id}>{column.text}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.text}</th>
                  {columns.map((column, columnIndex) => (
                    <td key={column.id}>
                      <input
                        type={oneColumnPerRow ? "radio" : "checkbox"}
                        name={`grid-${item.id}-${row.id}`}
                        checked={row.correctColumnOrders.includes(columnIndex + 1)}
                        onChange={(event) => toggleCorrect(row.id, columnIndex + 1, event.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
