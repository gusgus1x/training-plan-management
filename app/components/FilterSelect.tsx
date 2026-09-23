"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./FilterSelect.module.css";

/** What a dropdown shows, and every lower-cased spelling that finds it when typed. */
export type FilterOption = { label: string; search: string[] };

/**
 * A picked label matches exactly, so "ผลิต 1" does not also pull in "ผลิต 10"; anything else typed
 * matches as a substring of any spelling.
 */
export const matchesFilter = (wanted: string, picked: Set<string>, spellings: string[]) => {
  const needle = wanted.trim().toLowerCase();
  if (!needle) return true;
  if (picked.has(needle)) return spellings.some((value) => value.toLowerCase() === needle);
  return spellings.some((value) => value.toLowerCase().includes(needle));
};

type Props = {
  label: string;
  /** False when the caller already prints its own label beside the box. */
  showLabel?: boolean;
  placeholder: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

/** A dropdown that is also a search box. The browser's own datalist cannot be styled or themed. */
export default function FilterSelect({ label, showLabel = true, placeholder, value, options, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  const typed = value.trim().toLowerCase();
  const shown = options.filter((option) => !typed || option.search.some((text) => text.includes(typed)));

  return (
    <div className={styles.filter} ref={wrapperRef}>
      {showLabel ? <span className={styles.filterLabel}>{label}</span> : null}
      <div className={styles.filterBox}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          role="combobox"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-label={label}
        />
        {value ? (
          <button type="button" className={styles.clearBtn} onClick={() => onChange("")} aria-label="clear">
            ×
          </button>
        ) : null}
        <button type="button" className={styles.caretBtn} onClick={() => setIsOpen(!isOpen)} aria-label={label} tabIndex={-1}>
          ▾
        </button>
        {isOpen ? (
          <ul className={styles.options} id={listId} role="listbox">
            {shown.length ? (
              shown.map((option) => (
                <li key={option.label}>
                  <button
                    type="button"
                    className={styles.option}
                    data-selected={option.label === value || undefined}
                    onClick={() => {
                      onChange(option.label);
                      setIsOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            ) : (
              <li className={styles.optionEmpty}>—</li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
