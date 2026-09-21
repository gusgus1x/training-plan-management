"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Search, User, XCircle } from "../icons/LucideIcons";
import { useUiLanguage } from "../ThaiUiLocalization";
import styles from "./SearchableApproverSelect.module.css";

export type ApproverCandidateItem = {
  reviewerUserId: string;
  employeeUserId: string;
  employeeCode: string;
  name: string;
  position: string;
  rank: number;
  rankTitleEn: string;
  rankTitleTh: string;
  company: string;
  department: string;
  section: string;
};

export type SearchableApproverSelectProps = {
  candidates: ApproverCandidateItem[];
  selectedApproverId: string;
  onSelect: (approverId: string) => void;
  placeholder?: string;
};

export default function SearchableApproverSelect({
  candidates,
  selectedApproverId,
  onSelect,
  placeholder,
}: SearchableApproverSelectProps) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const [query, setQuery] = useState("");

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;

    return candidates.filter((cand) => {
      const matchName = cand.name.toLowerCase().includes(q);
      const matchCode = cand.employeeCode.toLowerCase().includes(q);
      const matchPosition = cand.position.toLowerCase().includes(q);
      const matchRankTh = (cand.rankTitleTh || "").toLowerCase().includes(q);
      const matchRankEn = (cand.rankTitleEn || "").toLowerCase().includes(q);
      const matchDept = (cand.department || "").toLowerCase().includes(q);
      const matchSection = (cand.section || "").toLowerCase().includes(q);
      const matchCompany = (cand.company || "").toLowerCase().includes(q);

      return (
        matchName ||
        matchCode ||
        matchPosition ||
        matchRankTh ||
        matchRankEn ||
        matchDept ||
        matchSection ||
        matchCompany
      );
    });
  }, [candidates, query]);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.reviewerUserId === selectedApproverId),
    [candidates, selectedApproverId],
  );

  return (
    <div className={styles.container}>
      {/* Live Search Box */}
      <div className={styles.searchBox}>
        <div className={styles.searchIcon} aria-hidden="true">
          <Search size={18} />
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={
            placeholder ||
            t("ค้นหาชื่อ, รหัสพนักงาน, แผนก, ตำแหน่ง...", "Search name, code, dept, position...")
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("ค้นหารายชื่อผู้อนุมัติ", "Search approver list")}
        />
        {query ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => setQuery("")}
            title={t("ล้างคำค้นหา", "Clear search")}
            aria-label="Clear search query"
          >
            <XCircle size={18} />
          </button>
        ) : null}
      </div>

      {/* Meta Bar */}
      <div className={styles.searchMeta}>
        <span className={styles.metaCount}>
          {query
            ? t(
                `พบ ${filteredCandidates.length} ท่าน (จากทั้งหมด ${candidates.length} ท่าน)`,
                `Found ${filteredCandidates.length} of ${candidates.length} approvers`,
              )
            : t(`รายชื่อผู้อนุมัติทั้งหมด (${candidates.length} ท่าน)`, `All eligible approvers (${candidates.length})`)}
        </span>
        {selectedCandidate ? (
          <span className={styles.selectedPill}>
            ✓ {t("เลือกแล้ว:", "Selected:")} {selectedCandidate.name}
          </span>
        ) : null}
      </div>

      {/* Candidates List */}
      <div className={styles.listContainer} role="listbox" aria-label="Approver candidates">
        {filteredCandidates.length > 0 ? (
          filteredCandidates.map((cand) => {
            const isSelected = cand.reviewerUserId === selectedApproverId;
            return (
              <button
                key={cand.reviewerUserId}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.candidateCard} ${isSelected ? styles.candidateCardSelected : ""}`}
                onClick={() => onSelect(cand.reviewerUserId)}
              >
                {/* Avatar Icon */}
                <div className={styles.avatarBadge} aria-hidden="true">
                  <User size={18} />
                </div>

                {/* Candidate Information */}
                <div className={styles.candidateInfo}>
                  <div className={styles.candidateHeader}>
                    <span className={styles.candidateName}>{cand.name}</span>
                    {cand.employeeCode ? (
                      <span className={styles.candidateCode}>({cand.employeeCode})</span>
                    ) : null}
                    <span className={styles.companyBadge}>[{cand.company}]</span>
                  </div>
                  <div className={styles.candidateMeta}>
                    <span className={styles.candidatePosition}>
                      {isThai ? cand.rankTitleTh || cand.position : cand.rankTitleEn || cand.position}
                    </span>
                    {cand.department ? <span>• {cand.department}</span> : null}
                    {cand.section ? <span>({cand.section})</span> : null}
                  </div>
                </div>

                {/* Radio / Selection Indicator */}
                <div className={styles.selectedIndicator}>
                  {isSelected ? (
                    <CheckCircle2 size={22} style={{ color: "var(--ui-30-primary, #10b981)" }} />
                  ) : (
                    <div className={styles.unselectedCircle} />
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <span>{t("ไม่พบรายชื่อผู้อนุมัติที่ตรงกับคำค้นหา", "No matching approvers found")}</span>
            {query ? (
              <button type="button" className={styles.resetSearchBtn} onClick={() => setQuery("")}>
                {t("ล้างคำค้นหา", "Reset filter")}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
