"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "./icons/LucideIcons";
import styles from "./SearchableSelect.module.css";

export interface SearchableSelectOption {
  value: string;
  label: string;
  secondaryLabel?: string;
  badge?: React.ReactNode;
  keywords?: string;
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
  placeholder = "พิมพ์เพื่อค้นหา... / Type to search...",
  disabled = false,
  emptyText = "ไม่พบข้อมูลที่ตรงกัน / No matching results",
  className,
  style,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Focus input automatically and scroll into view when search opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const neededBottom = rect.bottom + 360;
        if (neededBottom > window.innerHeight) {
          window.scrollBy({
            top: Math.min(260, neededBottom - window.innerHeight + 24),
            behavior: "smooth",
          });
        }
      }
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchVal = opt.value.toLowerCase().includes(query);
      const matchSec = opt.secondaryLabel?.toLowerCase().includes(query) ?? false;
      const matchBadge = typeof opt.badge === "string" ? opt.badge.toLowerCase().includes(query) : false;
      const matchKeywords = opt.keywords?.toLowerCase().includes(query) ?? false;
      return matchLabel || matchVal || matchSec || matchBadge || matchKeywords;
    });
  }, [options, searchQuery]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
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
    <div
      ref={containerRef}
      className={`${styles.container} ${isOpen ? styles.containerOpen : ""} ${className || ""}`}
      style={style}
    >
      {selectedOption && !isOpen ? (
        /* ─── Rich Selected Display Box ─── */
        <div
          className={`${styles.selectedBox} ${disabled ? styles.selectedBoxDisabled : ""}`}
          onClick={() => {
            if (!disabled) {
              handleOpen();
            }
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
              e.preventDefault();
              handleOpen();
            }
          }}
          title="คลิกเพื่อค้นหาและเปลี่ยนหลักสูตร / Click to change course"
        >
          <div className={styles.selectedContent}>
            <div className={styles.selectedMainRow}>
              <span className={styles.selectedLabel}>{selectedOption.label}</span>
              {selectedOption.badge ? (
                <span className={styles.selectedBadge}>{selectedOption.badge}</span>
              ) : null}
            </div>
            {selectedOption.secondaryLabel ? (
              <span className={styles.selectedSecondary}>{selectedOption.secondaryLabel}</span>
            ) : null}
          </div>
          <div className={styles.selectedActions}>
            {!disabled && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={handleClear}
                title="ล้างข้อมูล / Clear selection"
              >
                <X size={15} />
              </button>
            )}
            <span className={styles.arrowIcon}>▼</span>
          </div>
        </div>
      ) : (
        /* ─── Interactive Search Input ─── */
        <div
          className={styles.inputWrapper}
          onClick={() => {
            if (!disabled && !isOpen) {
              handleOpen();
            }
          }}
        >
          <span className={styles.searchIconLeft}>
            <Search size={16} />
          </span>
          <input
            ref={inputRef}
            className={`${styles.input} ${isOpen ? styles.inputOpen : ""}`}
            type="text"
            disabled={disabled}
            placeholder={
              isOpen
                ? placeholder
                : selectedOption
                ? selectedOption.label
                : placeholder
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedIndex(0);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled && !isOpen) {
                handleOpen();
              }
            }}
            onKeyDown={handleKeyDown}
          />

          {searchQuery ? (
            <button
              type="button"
              className={styles.inputClearBtn}
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          ) : null}

          <span
            className={`${styles.arrowIcon} ${styles.inputArrowIcon} ${isOpen ? styles.arrowIconOpen : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false);
                  setSearchQuery("");
                } else {
                  handleOpen();
                }
              }
            }}
          >
            ▼
          </span>
        </div>
      )}

      {/* ─── Options Dropdown Menu (Always drops DOWN below input) ─── */}
      {isOpen && !disabled ? (
        <div className={styles.dropdownMenu} role="listbox">
          <div className={styles.dropdownHeader}>
            <span>
              {filteredOptions.length === 0
                ? "ไม่พบข้อมูล"
                : `พบทั้งหมด ${filteredOptions.length} รายการ`}
            </span>
            {searchQuery.trim() ? (
              <span style={{ fontWeight: 500, fontSize: "0.72rem" }}>
                ค้นหา: &ldquo;{searchQuery}&rdquo;
              </span>
            ) : null}
          </div>

          <div ref={listRef} className={styles.optionsList}>
            {filteredOptions.length === 0 ? (
              <div className={styles.noOptions}>{emptyText}</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={opt.value || idx}
                    className={`${styles.optionItem} ${
                      isSelected ? styles.optionSelected : ""
                    } ${isHighlighted ? styles.optionHighlighted : ""}`}
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
                    {isSelected ? (
                      <span className={styles.optionCheckmark}>
                        <Check size={16} strokeWidth={2.5} />
                      </span>
                    ) : null}

                    <div className={styles.optionTextWrap}>
                      <div className={styles.optionMainRow}>
                        <span className={styles.optionLabel}>{opt.label}</span>
                        {opt.badge ? (
                          <span className={styles.optionBadge}>{opt.badge}</span>
                        ) : null}
                      </div>
                      {opt.secondaryLabel ? (
                        <span className={styles.optionSecondary}>
                          {opt.secondaryLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
