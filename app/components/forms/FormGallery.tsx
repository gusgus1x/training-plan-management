"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listAssessments } from "../../lib/assessments/client";
import { listEvaluations } from "../../lib/evaluations/client";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useUiLanguage } from "../ThaiUiLocalization";
import { isBlockType, type DraftItemType } from "./formDraft";
import { Building2, ChevronLeft, Eye, FileText, Pencil, Plus, Search, Star } from "../icons/LucideIcons";
import styles from "./FormGallery.module.css";

/**
 * Every assessment and evaluation form, as cards, the way a form tool shows them.
 *
 * The two kinds share this screen rather than having one each: they are the same object to the
 * person making one - a form with questions, an owner and a published state - and the only thing
 * that differs is which endpoint it is read from. A second copy of this file would be the place
 * the two quietly drift apart.
 *
 * Three sections, in the order somebody works in: something to start, then their own, then
 * everybody else's. A form nobody has published yet is unfinished business, so it sits with the
 * blank card rather than in a list of things that are in use.
 */

export type FormKind = "assessment" | "evaluation";

export type GalleryForm = {
  id: string;
  name: string;
  code: string;
  /** ACTIVE / PUBLISHED both mean "in use"; DRAFT means nobody has published it yet. */
  isDraft: boolean;
  statusLabel: string;
  companyCode: string | null;
  companyName: string | null;
  questionCount: number;
  updatedAt: string | null;
  canModify: boolean;
  createdBy: string;
};

const KIND_LABELS: Record<FormKind, { th: string; en: string }> = {
  assessment: { th: "แบบทดสอบ", en: "Assessment" },
  evaluation: { th: "แบบประเมิน", en: "Evaluation" },
};

/** CENTRAL is a company code here so the grouping has one kind of key, not two. */
const CENTRAL = "CENTRAL";

/**
 * Where "กลับ" goes. Not `router.back()`: the builder's own back button pushes this gallery, so
 * history's previous entry is the builder somebody just left, and the two pages bounce.
 * The module that owns the forms is the only honest destination.
 */
const OWNER_SECTION: Record<FormKind, string> = {
  assessment: "/training-course/assessment",
  evaluation: "/training-course/evaluation-management",
};

/**
 * How many questions a form asks. Section breaks and text blocks live in the same table as the
 * questions - they are rows on the form, not things anybody answers - so counting rows told a
 * reader a form was longer than it is.
 */
const countQuestions = (rows: ReadonlyArray<{ questionType: string }>) =>
  rows.filter((row) => !isBlockType(row.questionType as DraftItemType)).length;

export type GallerySections = {
  drafts: GalleryForm[];
  mine: GalleryForm[];
  companies: { code: string; name: string; rows: GalleryForm[] }[];
};

/**
 * The three sections, from one list and who is reading it.
 *
 * "Mine" is what my side owns - the centre's own forms for a centre user, the factory's own company
 * for a factory user - and the unfinished half of that is what sits with the blank card, because a
 * draft is work somebody has not finished rather than something in use. Everything else belongs to
 * another company, which for a factory reader is only ever the centre's, because the list the
 * server hands it never contains another factory's forms.
 */
export const sortIntoSections = (
  forms: readonly GalleryForm[],
  query: string,
  ownCode: string | null,
): GallerySections => {
  const normalized = query.trim().toLowerCase();
  const visible = forms.filter(
    (form) =>
      normalized === "" ||
      form.name.toLowerCase().includes(normalized) ||
      form.code.toLowerCase().includes(normalized),
  );
  const isOwn = (form: GalleryForm) => (form.companyCode ?? CENTRAL) === ownCode;

  const groups = new Map<string, { code: string; name: string; rows: GalleryForm[] }>();
  for (const form of visible.filter((form) => !isOwn(form))) {
    const code = form.companyCode ?? CENTRAL;
    const group = groups.get(code);
    if (group) group.rows.push(form);
    else groups.set(code, { code, name: form.companyName ?? code, rows: [form] });
  }

  return {
    drafts: visible.filter((form) => isOwn(form) && form.isDraft),
    mine: visible.filter((form) => isOwn(form) && !form.isDraft),
    companies: [...groups.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
};

const formatDate = (iso: string | null) =>
  iso === null
    ? ""
    : new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

export default function FormGallery({ kind }: { kind: FormKind }) {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { language } = useUiLanguage();
  /** The same helper the builder and both old editors use. */
  const t = (th: string, en: string) => (language === "th" ? th : en);

  const [forms, setForms] = useState<GalleryForm[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const read =
      kind === "assessment"
        ? listAssessments().then((result) =>
            result.items.map<GalleryForm>((item) => ({
              id: item.assessmentId,
              name: item.seriesName,
              code: item.seriesCode,
              isDraft: item.status === "DRAFT",
              statusLabel: item.status,
              companyCode: item.scope === "CENTRAL" ? CENTRAL : item.companyCode,
              companyName: item.companyName,
              questionCount: countQuestions(item.questions),
              updatedAt: item.updatedAt ?? item.createdAt,
              canModify: item.canModify,
              createdBy: item.createdBy,
            })),
          )
        : listEvaluations().then((result) =>
            result.items.map<GalleryForm>((item) => ({
              id: item.evaluationFormId,
              name: item.formName,
              code: item.formCode,
              isDraft: item.status === "DRAFT",
              statusLabel: item.status,
              companyCode: item.scope === "CENTRAL" ? CENTRAL : item.companyCode,
              companyName: item.companyName,
              questionCount: countQuestions(item.questions),
              updatedAt: item.updatedAt ?? item.createdAt,
              canModify: item.canModify,
              createdBy: item.createdBy,
            })),
          );

    read
      .then((rows) => {
        if (!cancelled) setForms(rows);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setForms([]);
        setLoadError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const { drafts, mine, companies } = useMemo(
    () =>
      sortIntoSections(
        forms ?? [],
        query,
        user?.roleCode === "HRD_CENTER" ? CENTRAL : user?.companyCode ?? null,
      ),
    [forms, query, user?.roleCode, user?.companyCode],
  );

  const label = KIND_LABELS[kind];
  const openBuilder = (formId: string) => router.push(`/forms/${kind}/${formId}`);

  const card = (form: GalleryForm) => (
    // The card opens on a click anywhere, and carries its own button as well: the button is what
    // says the card is for opening, and what a keyboard can reach.
    <div key={form.id} className={styles.card} onClick={() => openBuilder(form.id)}>
      <span className={styles.thumb} aria-hidden="true">
        <FileText size={26} />
      </span>
      <span className={styles.cardBody}>
        <strong className={styles.cardTitle}>{form.name || form.code}</strong>
        <span className={styles.cardMeta}>{form.code}</span>
        <span className={styles.cardMeta}>
          {t(`${form.questionCount} ข้อ`, `${form.questionCount} questions`)}
          {form.updatedAt ? ` · ${formatDate(form.updatedAt)}` : ""}
        </span>
        <span className={styles.cardFooter}>
          {/* A form outside my scope opens, but only to be read. */}
          {form.canModify ? null : (
            <span className={styles.readOnlyTag}>
              <Eye size={12} /> {t("ดูอย่างเดียว", "Read-only")}
            </span>
          )}
          <button type="button" className={styles.cardAction} onClick={() => openBuilder(form.id)}>
            {form.canModify ? (
              <>
                <Pencil size={13} /> {t("แก้ไข", "Edit")}
              </>
            ) : (
              <>
                <Eye size={13} /> {t("ดู", "View")}
              </>
            )}
          </button>
        </span>
      </span>
      <span className={form.isDraft || form.statusLabel === "INACTIVE" ? styles.draftTag : styles.liveTag}>
        {form.isDraft ? t("ยังไม่เผยแพร่", "Not published") : form.statusLabel === "INACTIVE" ? t("ปลดระวางแล้ว", "Retired") : t("เผยแพร่แล้ว", "Published")}
      </span>
    </div>
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.backButton} onClick={() => router.push(OWNER_SECTION[kind])}>
            <ChevronLeft size={16} /> {t("กลับ", "Back")}
          </button>
          <div>
            <p className={styles.kicker}>{label.en} forms</p>
            <h1>{label.th}</h1>
          </div>
        </div>
        <div className={styles.searchBox}>
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(`ค้นหา${label.th} หรือรหัสฟอร์ม`, `Search ${label.en.toLowerCase()} or form code`)}
          />
        </div>
      </header>

      {loadError ? <p className={styles.note}>{t("โหลดรายการไม่สำเร็จ: ", "Could not load the list: ")}{loadError}</p> : null}
      {forms === null ? <p className={styles.note}>{t("กำลังโหลด...", "Loading...")}</p> : null}

      <section className={styles.section}>
        <h2>
          <Plus size={16} aria-hidden="true" /> {t("แบบฟอร์มใหม่", "New forms")}
        </h2>
        <div className={styles.grid}>
          <button type="button" className={styles.blankCard} onClick={() => router.push(`/forms/${kind}/new`)}>
            <span className={styles.blankPlus} aria-hidden="true">
              <Plus size={30} />
            </span>
            <strong>{t(`สร้าง${label.th}ใหม่`, `Create ${label.en.toLowerCase()}`)}</strong>
          </button>
          {/* Unpublished forms belong here rather than in a list of things in use: they are the
              work somebody has not finished, which is what this section is for. */}
          {drafts.map(card)}
        </div>
      </section>

      <section className={styles.section}>
        <h2>
          <Star size={16} aria-hidden="true" /> {t("แบบฟอร์มของฉัน", "My forms")}
        </h2>
        {mine.length === 0 ? (
          <p className={styles.note}>{t(`คุณยังไม่ได้เผยแพร่${label.th}ไว้`, `You have not published any ${label.en.toLowerCase()} yet`)}</p>
        ) : (
          <div className={styles.grid}>{mine.map(card)}</div>
        )}
      </section>

      <section className={styles.section}>
        <h2>
          <Building2 size={16} aria-hidden="true" /> {t("แบบฟอร์มบริษัท", "Company forms")}
        </h2>
        {companies.length === 0 ? (
          <p className={styles.note}>{t(`ยังไม่มี${label.th}ที่เผยแพร่แล้ว`, `No ${label.en.toLowerCase()} from other companies yet`)}</p>
        ) : (
          companies.map((group) => (
            <div className={styles.companyBlock} key={group.code}>
              <h3 className={styles.companyName}>
                {group.code === CENTRAL ? t("ส่วนกลาง", "Central") : group.code}
                {group.name && group.name !== group.code ? <small>{group.name}</small> : null}
                <span className={styles.companyCount}>{group.rows.length}</span>
              </h3>
              <div className={styles.grid}>{group.rows.map(card)}</div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
