"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SearchableSelect.module.css";

export interface SearchableSelectOption {
  value: string;
  label: string;
  secondaryLabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "🔍 พิมพ์เพื่อค้นหา... / Type to search...",
  disabled = false,
  emptyText = "ไม่พบข้อมูลที่ตรงกัน / No matching results",
  className,
  style,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // The dropdown defaults to opening downward; on a short phone viewport with the field near
  // the bottom (very common once the on-screen keyboard shrinks it further) that pushes most of
  // the menu off-screen, so this flips it upward when there isn't enough room below.
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const DROPDOWN_MAX_HEIGHT = 280;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchVal = opt.value.toLowerCase().includes(query);
      const matchSec = opt.secondaryLabel?.toLowerCase().includes(query) ?? false;
      const matchBadge = opt.badge?.toLowerCase().includes(query) ?? false;
      return matchLabel || matchVal || matchSec || matchBadge;
    });
  }, [options, searchQuery]);

  const openDropdown = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow);
    }
    setIsOpen(true);
  };

  const handleOpen = () => {
    if (disabled) return;
    openDropdown();
    setSearchQuery("");
    setHighlightedIndex(0);
  };

  const handleSelectOption = (optValue: string) => {
    setIsOpen(false);
    setSearchQuery("");
    inputRef.current?.blur();
    onChange(optValue);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredOptions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % Math.max(1, filteredOptions.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelectOption(filteredOptions[highlightedIndex].value);
      }
    }
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ""}`} style={style}>
      <div
        className={styles.inputWrapper}
        onClick={() => {
          if (!disabled && !isOpen) {
            handleOpen();
          }
        }}
      >
        <input
          ref={inputRef}
          className={`${styles.input} ${isOpen ? styles.inputOpen : ""}`}
          type="text"
          disabled={disabled}
          placeholder={isOpen ? placeholder : selectedOption ? selectedOption.label : placeholder}
          value={isOpen ? searchQuery : selectedOption ? selectedOption.label : ""}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) openDropdown();
          }}
          onFocus={() => {
            if (!disabled && !isOpen) {
              handleOpen();
            }
          }}
          onKeyDown={handleKeyDown}
        />

        {value && !disabled ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            title="Clear selection"
          >
            ✕
          </button>
        ) : null}

        <span
          className={`${styles.arrowIcon} ${isOpen ? styles.arrowIconOpen : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              if (isOpen) {
                setIsOpen(false);
                setSearchQuery("");
                inputRef.current?.blur();
              } else {
                handleOpen();
                inputRef.current?.focus();
              }
            }
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && !disabled ? (
        <div className={`${styles.dropdownMenu} ${openUpward ? styles.dropdownMenuUp : ""}`} role="listbox">
          {filteredOptions.length === 0 ? (
            <div className={styles.noOptions}>{emptyText}</div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={opt.value || idx}
                  className={`${styles.optionItem} ${isSelected ? styles.optionSelected : ""} ${
                    isHighlighted ? styles.optionHighlighted : ""
                  }`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectOption(opt.value);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className={styles.optionMainRow}>
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {opt.badge ? <span className={styles.optionBadge}>{opt.badge}</span> : null}
                  </div>
                  {opt.secondaryLabel ? (
                    <span className={styles.optionSecondary}>{opt.secondaryLabel}</span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
