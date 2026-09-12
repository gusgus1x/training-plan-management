"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAssessment,
  createAssessmentVersion,
  getAssessment,
  listAssessments,
  setAssessmentStatus,
  updateAssessment,
  AssessmentClientError,
} from "../../lib/assessments/client";
import {
  createEvaluation,
  getEvaluation,
  listEvaluations,
  setEvaluationStatus,
  updateEvaluation,
} from "../../lib/evaluations/client";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useUiLanguage } from "../ThaiUiLocalization";
import {
  fallThroughLabel,
  remapSectionOrdinals,
  sectionCountOf,
  sectionIndexPerRow,
  SUBMIT_SECTION,
} from "../../lib/formBlocks";
import { useToast } from "../ToastHost";
import { useConfirm } from "../ConfirmDialog";
import FormItemToolbar, {
  type FormItemKind,
} from "../center_factory/TrainingCourseManagement/modules/FormItemToolbar";
import FormPreviewRunner from "../center_factory/TrainingCourseManagement/modules/FormPreviewRunner";
import {
  ChevronLeft,
  Check,
  ClipboardList,
  Eye,
  FileText,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from "../icons/LucideIcons";
import {
  blankDraft,
  blankItem,
  draftFromAssessment,
  draftFromEvaluation,
  isBlockType,
  isGridType,
  localId,
  toAssessmentInput,
  toEvaluationInput,
  toPreviewItems,
  validateDraft,
  QUESTION_TYPES,
  type DraftIssueCode,
  type DraftItem,
  type DraftItemType,
  type FormDraft,
  type FormKind,
} from "./formDraft";
import { gridTotalScore } from "../../lib/formGrids";
import { canRedo, canUndo, historyReducer, initialHistory } from "./draftHistory";
import GridEditor from "./GridEditor";
import styles from "./FormBuilder.module.css";

/**
 * Building one form, a card at a time.
 *
 * One component for both kinds, because the two are the same job: a settings card, a stack of item
 * cards, and three decisions at the top right - keep it, publish it, or see it as the learner will.
 * What differs is the handful of settings and whether an answer can be right, and both of those are
 * a `kind` check rather than a second screen.
 *
 * Saving is deliberately explicit. A form in the middle of being written is not a form anybody
 * should be answering, so nothing here writes until somebody says so.
 */

type Lifecycle = "DRAFT" | "LIVE" | "RETIRED";

/**
 * The dot the rest of the app uses to say "this field still wants something", carried across from
 * the old editors so a form here reads the same way as a course or a plan does.
 */
const RequiredIndicator = ({ isFilled, title }: { isFilled: boolean; title: string }) => (
  <span className={isFilled ? styles.indicatorDone : styles.indicatorPending} title={title} />
);

/** ACTIVE on an assessment and PUBLISHED on an evaluation are the same thing to this screen. */
const lifecycleOf = (status: string): Lifecycle =>
  status === "DRAFT" ? "DRAFT" : status === "INACTIVE" ? "RETIRED" : "LIVE";

export default function FormBuilder({ kind, formId }: { kind: FormKind; formId: string }) {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { language } = useUiLanguage();
  /** The same two-argument helper both old editors use, so the wording can be lifted across. */
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const toast = useToast();
  const confirm = useConfirm();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const isNew = formId === "new";

  // A new form starts as a blank draft here rather than in an effect: there is nothing to fetch,
  // and setting state from an effect is a render the page does not need.
  const [history, dispatch] = useReducer(
    historyReducer,
    isNew ? blankDraft(kind, user?.companyId ?? null, !isCenter) : null,
    initialHistory,
  );
  const draft = history.present;
  const [savedId, setSavedId] = useState(isNew ? "" : formId);
  /**
   * The three states the two kinds share, under one set of names. A live form is the only one that
   * cannot be edited: a retired one is out of use, so changing it disturbs nobody, and both
   * services allow exactly that as long as nobody has answered it.
   */
  const [lifecycle, setLifecycle] = useState<Lifecycle>("DRAFT");
  const isLive = lifecycle === "LIVE";
  /** A form from outside my own scope. The server refuses a write to it, so the screen does too. */
  const [isForeign, setIsForeign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** How the form looked when the current drag started, so the whole drag is one undo step. */
  const dragStartRef = useRef<FormDraft | null>(null);
  /** Forms that can be copied to start this one. Only a new form has anything to do with them. */
  const [templates, setTemplates] = useState<{ id: string; code: string; name: string }[]>([]);
  /**
   * Whether the problems are on screen yet.
   *
   * Nothing is marked wrong while a form is still being written - a blank question is not a mistake
   * until somebody tries to save it. The first refused save turns them on, and from then on they
   * follow the draft as it is corrected rather than sitting where they were raised.
   */
  const [showIssues, setShowIssues] = useState(false);
  /**
   * Where the floating toolbar sits: the top of the focused card, measured from the wrapper it is
   * positioned against. Null pins it to the top, which is the state before anything is focused.
   */
  const [anchorTop, setAnchorTop] = useState<number | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const pendingScrollRef = useRef<string | null>(null);

  /** Registers a card so the toolbar can measure it, and drops it again when the card goes. */
  const cardRef = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) cardRefs.current.set(id, element);
      else cardRefs.current.delete(id);
    },
    [],
  );

  useLayoutEffect(() => {
    const focused = focusedItemId === null ? undefined : cardRefs.current.get(focusedItemId);
    setAnchorTop(focused?.offsetTop ?? null);

    const pending = pendingScrollRef.current;
    if (pending === null) return;
    pendingScrollRef.current = null;
    const card = cardRefs.current.get(pending);
    // `nearest` rather than `start`: a card added just below the one in view should not throw the
    // page to the top of it and leave the work above off-screen.
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // The cursor lands in the new card's first field, so typing carries on where the eye went.
    (card?.querySelector("input, textarea") as HTMLElement | null)?.focus({ preventScroll: true });
  }, [focusedItemId, draft?.items]);

  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    const read =
      kind === "assessment"
        ? listAssessments().then((result) =>
            result.items.map((item) => ({
              id: item.assessmentId,
              code: item.seriesCode,
              name: item.seriesName,
            })),
          )
        : listEvaluations().then((result) =>
            result.items.map((item) => ({
              id: item.evaluationFormId,
              code: item.formCode,
              name: item.formName,
            })),
          );
    read
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch(() => {
        // No templates offered is a smaller failure than a screen that will not open.
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, kind]);

  /**
   * Starts this form from one that already exists.
   *
   * Everything is copied except the identity: the code is left empty for the server to generate and
   * the name is marked as a copy, so saving can never write over the form it was taken from. The
   * source is only read.
   */
  const applyTemplate = async (sourceId: string) => {
    if (sourceId === "") return;
    setBusy(true);
    try {
      const copied =
        kind === "assessment"
          ? draftFromAssessment((await getAssessment(sourceId)).assessment)
          : draftFromEvaluation((await getEvaluation(sourceId)).evaluation);
      dispatch({
        type: "reset",
        draft: { ...copied, code: "", name: t(`${copied.name} (สำเนา)`, `${copied.name} (copy)`) },
        at: Date.now(),
      });
      toast.success(t("คัดลอกจากแม่แบบแล้ว", "Copied from the template"));
    } catch (cause) {
      toast.error((cause as Error).message || t("ดึงแม่แบบไม่สำเร็จ", "Could not read that template"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    const read =
      kind === "assessment"
        ? getAssessment(formId).then((result) => ({
            draft: draftFromAssessment(result.assessment),
            lifecycle: lifecycleOf(result.assessment.status),
            foreign: !result.assessment.canModify,
          }))
        : getEvaluation(formId).then((result) => ({
            draft: draftFromEvaluation(result.evaluation),
            lifecycle: lifecycleOf(result.evaluation.status),
            foreign: !result.evaluation.canModify,
          }));

    read
      .then(({ draft, lifecycle, foreign }) => {
        if (cancelled) return;
        dispatch({ type: "reset", draft, at: Date.now() });
        setLifecycle(lifecycle);
        setIsForeign(foreign);
      })
      .catch((cause: Error) => {
        if (!cancelled) setLoadError(cause.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, formId]);

  /**
   * Every change goes through here, which is what makes undo possible at all.
   *
   * `discrete` marks a change that is its own step whatever the clock says - adding a card,
   * deleting one, moving one. Typing is left to coalesce, so undo steps back by a word rather than
   * by a keystroke.
   */
  const edit = useCallback(
    (change: (current: FormDraft) => FormDraft, discrete = false) => {
      if (draft === null) return;
      dispatch({ type: "edit", draft: change(draft), at: Date.now(), discrete });
    },
    [draft],
  );

  const editItem = (itemId: string, change: (item: DraftItem) => DraftItem) =>
    edit((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? change(item) : item)),
    }));

  /**
   * A change to the list of rows, with every branch target rewritten to follow it.
   *
   * Targets are stored as section ordinals, so moving, adding or deleting a section renumbers the
   * sections underneath them. Without the rewrite, "go to section 3" quietly starts meaning a
   * different section, which is the failure a branched form shows only to the learner.
   */
  const reorderItems = (change: (items: DraftItem[]) => DraftItem[]) =>
    edit((current) => {
      const after = change(current.items);
      const rows = (list: DraftItem[]) => list.map((item) => ({ id: item.id, questionType: item.type }));
      const map = remapSectionOrdinals(rows(current.items), rows(after));
      const move = (target: number | null) => (target === null ? null : map.get(target) ?? null);
      return {
        ...current,
        items: after.map((item) => ({
          ...item,
          nextSection: move(item.nextSection),
          options: item.options.map((option) => ({ ...option, nextSection: move(option.nextSection) })),
        })),
      };
    }, true);

  /**
   * Switches a question to another type, keeping the choices already typed where they still mean
   * the same thing. Single choice and multiple choice are one list read two ways, so rebuilding the
   * card from blank threw the typing away for nothing. Every other move does rebuild - a grid, a
   * rating scale and true/false each own their list rather than borrowing one.
   */
  const changeItemType = (itemId: string, type: DraftItemType) =>
    editItem(itemId, (current) => {
      const sameList =
        (current.type === "SINGLE_CHOICE" || current.type === "MULTIPLE_CHOICE") &&
        (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE");
      const fresh = blankItem(type);
      // Only one answer can be right on a single choice, so the ticks past the first cannot survive
      // the move. The text of every choice does.
      const firstCorrect = current.options.findIndex((choice) => choice.isCorrect);
      return {
        ...fresh,
        id: current.id,
        text: current.text,
        description: current.description,
        isRequired: current.isRequired,
        score: current.score,
        options: !sameList
          ? fresh.options
          : current.options.map((choice, index) => ({
              ...choice,
              isCorrect: type === "MULTIPLE_CHOICE" ? choice.isCorrect : index === firstCorrect,
            })),
      };
    });

  /**
   * Adds a row directly below the card being worked on, the way a form tool does, and takes the
   * screen with it: the toolbar follows the focused card, so a card added out of sight would move
   * the strip somewhere nobody is looking. `pendingScrollRef` carries the new id to the layout
   * effect, which is the first moment the card exists to be scrolled to.
   */
  const addItem = (itemKind: FormItemKind) => {
    const type: DraftItemType =
      itemKind === "QUESTION" ? QUESTION_TYPES[kind][0].value : (itemKind as DraftItemType);
    const created = blankItem(type);
    reorderItems((items) => {
      const at = items.findIndex((item) => item.id === focusedItemId);
      return at === -1 ? [...items, created] : [...items.slice(0, at + 1), created, ...items.slice(at + 1)];
    });
    setFocusedItemId(created.id);
    pendingScrollRef.current = created.id;
  };

  const duplicateItem = (itemId: string) =>
    reorderItems((items) => {
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return items;
      // The counter, not the clock and not the id it was copied from: two copies of one card made
      // inside the same millisecond used to share an id, and so did their options.
      const copy: DraftItem = {
        ...items[index],
        id: localId("item"),
        options: items[index].options.map((option) => ({ ...option, id: localId("opt") })),
      };
      const next = [...items];
      next.splice(index + 1, 0, copy);
      return next;
    });

  const removeItem = (itemId: string) => reorderItems((items) => items.filter((item) => item.id !== itemId));

  /**
   * Drops the dragged card immediately before the one it is over.
   *
   * `dragover` fires the whole time the card is held over another, so the move is written straight
   * onto the present and the history gets one entry at the end of the gesture. Pushing a step per
   * event filled the 60-entry history with states that looked identical and left undo doing nothing
   * visible several presses in a row.
   */
  const moveItemBefore = (draggedId: string, targetId: string) => {
    if (draft === null) return;
    const from = draft.items.findIndex((item) => item.id === draggedId);
    const to = draft.items.findIndex((item) => item.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const items = [...draft.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    // Same rewrite as every other reorder: a dragged section renumbers the ones after it.
    const rows = (list: DraftItem[]) => list.map((item) => ({ id: item.id, questionType: item.type }));
    const map = remapSectionOrdinals(rows(draft.items), rows(items));
    const move = (target: number | null) => (target === null ? null : map.get(target) ?? null);
    dispatch({
      type: "replace",
      draft: {
        ...draft,
        items: items.map((item) => ({
          ...item,
          nextSection: move(item.nextSection),
          options: item.options.map((option) => ({ ...option, nextSection: move(option.nextSection) })),
        })),
      },
    });
  };

  /** One history step for the whole drag, and none at all if it ended where it started. */
  const endDrag = () => {
    const before = dragStartRef.current;
    dragStartRef.current = null;
    setDraggingId(null);
    if (before !== null) dispatch({ type: "checkpoint", before, at: Date.now() });
  };

  const moveItem = (itemId: string, by: -1 | 1) =>
    reorderItems((items) => {
      const index = items.findIndex((item) => item.id === itemId);
      const target = index + by;
      if (index === -1 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  /**
   * Writes the new draft a published form has to become before it can be edited.
   *
   * An assessment has a version chain of its own: `createAssessmentVersion` hangs a new DRAFT under
   * the same series, which is why the code, the name and the purpose must arrive unchanged - the
   * series owns them. Copying it into a separate form instead, which is what this screen used to do,
   * broke the chain and was refused anyway, because a series name is unique.
   *
   * An evaluation has no chain, so a new one really is a copy: its own code, its own name.
   */
  /**
   * Takes the code the server generated at the first save.
   *
   * It matters beyond the label: every later update has to send the code back unchanged, and a
   * draft still carrying the empty string it was created with is refused with a code-locked 409.
   * It is written as a reset rather than an edit because a save is a checkpoint - undoing across
   * one would put the old code back and break the next save the same way.
   */
  const adoptCode = (code: string) => {
    if (draft === null || draft.code === code) return;
    dispatch({ type: "reset", draft: { ...draft, code }, at: Date.now() });
  };

  const createNextVersion = async () => {
    if (draft === null || !savedId) return false;
    try {
      if (kind === "assessment") {
        const result = await createAssessmentVersion(savedId, toAssessmentInput(draft, "DRAFT"));
        setSavedId(result.assessment.assessmentId);
        setLifecycle("DRAFT");
        toast.success(t("สร้างฉบับร่างเวอร์ชันใหม่แล้ว แก้ไขและกดเผยแพร่เมื่อพร้อม", "A new draft version is ready. Edit it and publish when you are."));
      } else {
        // An empty code asks the server for the next one, which is what keeps the copy unique.
        const copy: FormDraft = { ...draft, code: "", name: `${draft.name} (ฉบับใหม่)` };
        const result = await createEvaluation(toEvaluationInput(copy, "DRAFT"));
        dispatch({ type: "reset", draft: { ...copy, code: result.evaluation.formCode }, at: Date.now() });
        setSavedId(result.evaluation.evaluationFormId);
        setLifecycle("DRAFT");
        toast.success(t("คัดลอกเป็นฉบับร่างใหม่แล้ว แก้ไขและกดเผยแพร่เมื่อพร้อม", "Copied into a new draft. Edit it and publish when you are."));
      }
      return true;
    } catch (cause) {
      toast.error((cause as Error).message || t("สร้างเวอร์ชันใหม่ไม่สำเร็จ", "Could not create a new version"));
      return false;
    }
  };

  /**
   * Retiring a live form, and bringing a retired one back.
   *
   * Both services allow this whether or not the form has been answered, and on purpose: it changes
   * no content, and without it publishing something by mistake would be permanent.
   */
  const changeLifecycle = async (next: "LIVE" | "RETIRED") => {
    if (!savedId) return;
    setBusy(true);
    try {
      if (kind === "assessment") {
        const result = await setAssessmentStatus(savedId, next === "LIVE" ? "ACTIVE" : "INACTIVE");
        setLifecycle(lifecycleOf(result.assessment.status));
      } else {
        const result = await setEvaluationStatus(savedId, next === "LIVE" ? "PUBLISHED" : "INACTIVE");
        setLifecycle(lifecycleOf(result.evaluation.status));
      }
      toast.success(next === "LIVE" ? t("เปิดใช้แบบฟอร์มอีกครั้งแล้ว", "The form is published again") : t("ปลดระวางแบบฟอร์มแล้ว", "The form is retired"));
    } catch (cause) {
      toast.error((cause as Error).message || t("เปลี่ยนสถานะไม่สำเร็จ", "Could not change the status"));
    } finally {
      setBusy(false);
    }
  };

  const startNewVersion = async () => {
    if (draft === null) return;
    const ok = await confirm({
      title: { th: "สร้างเวอร์ชันใหม่", en: "Create a new version" },
      message: {
        th: "แบบฟอร์มที่เผยแพร่แล้วแก้ไม่ได้ ระบบจะคัดลอกเนื้อหาทั้งหมดเป็นฉบับร่างใหม่ให้แทน ของเดิมไม่เปลี่ยน",
        en: "A published form cannot be edited. Everything in it is copied into a new draft instead, and the published one is untouched.",
      },
      confirmLabel: { th: "คัดลอกเป็นฉบับร่าง", en: "Copy into a new draft" },
      cancelLabel: { th: "ยกเลิก", en: "Cancel" },
    });
    if (!ok) return;
    setBusy(true);
    await createNextVersion();
    setBusy(false);
  };

  /**
   * Writes the draft at the status asked for.
   *
   * A form already in use cannot be written at all - the server says so rather than letting one
   * change under the people answering it - so that refusal is turned into the offer it really is:
   * make a new version of this form.
   */
  const persist = async (status: "DRAFT" | "PUBLISH") => {
    if (draft === null) return;
    // A company form with no company is written with a null company, which reads as a central form
    // afterwards. Refusing here is the only place that can tell the two apart.
    if (draft.scope === "COMPANY" && !draft.companyId) {
      toast.error(t("เลือกบริษัทเจ้าของแบบฟอร์มก่อนบันทึก", "Choose the company this form belongs to first"));
      return;
    }
    // Every rule here restates one the service enforces. Saying so beside the field beats a 409
    // with one sentence for a whole form.
    const issues = validateDraft(draft, kind, status === "PUBLISH");
    if (issues.length > 0) {
      setShowIssues(true);
      toast.error(t("ยังกรอกไม่ครบ ดูช่องที่ทำเครื่องหมายไว้", "Something is missing. Check the marked fields."));
      return;
    }
    setShowIssues(false);
    setBusy(true);
    try {
      // Saving a retired form keeps it retired: the services allow INACTIVE to stay INACTIVE and
      // refuse it going back to DRAFT, so asking for a draft here would only produce a 409.
      const keep = lifecycle === "RETIRED" ? "RETIRED" : "DRAFT";
      if (kind === "assessment") {
        const input = toAssessmentInput(
          draft,
          status === "PUBLISH" ? "ACTIVE" : keep === "RETIRED" ? "INACTIVE" : "DRAFT",
        );
        const result = savedId ? await updateAssessment(savedId, input) : await createAssessment(input);
        setSavedId(result.assessment.assessmentId);
        setLifecycle(lifecycleOf(result.assessment.status));
        adoptCode(result.assessment.seriesCode);
        if (!savedId) router.replace(`/forms/${kind}/${result.assessment.assessmentId}`);
      } else {
        const input = toEvaluationInput(
          draft,
          status === "PUBLISH" ? "PUBLISHED" : keep === "RETIRED" ? "INACTIVE" : "DRAFT",
        );
        const result = savedId ? await updateEvaluation(savedId, input) : await createEvaluation(input);
        setSavedId(result.evaluation.evaluationFormId);
        setLifecycle(lifecycleOf(result.evaluation.status));
        adoptCode(result.evaluation.formCode);
        // The address bar still said "new", so a reload opened a blank form rather than this one.
        if (!savedId) router.replace(`/forms/${kind}/${result.evaluation.evaluationFormId}`);
      }
      toast.success(status === "PUBLISH" ? t("เผยแพร่แบบฟอร์มแล้ว", "The form is published") : t("บันทึกแบบร่างแล้ว", "Draft saved"));
    } catch (cause) {
      const locked =
        cause instanceof AssessmentClientError
          ? cause.code === "ASSESSMENT_LOCKED"
          : (cause as { code?: string })?.code === "EVALUATION_LOCKED";
      if (locked) {
        const ok = await confirm({
          title: { th: "แบบฟอร์มนี้ถูกใช้งานแล้ว", en: "This form is already in use" },
          message: {
            th: "แก้ไขของเดิมไม่ได้ เพราะมีคนทำไปแล้ว ต้องการสร้างเป็นเวอร์ชันใหม่หรือไม่?",
            en: "It cannot be edited because people have already answered it. Create a new version?",
          },
          confirmLabel: { th: "สร้างเวอร์ชันใหม่", en: "Create a new version" },
          cancelLabel: { th: "ยกเลิก", en: "Cancel" },
        });
        if (ok) await createNextVersion();
      } else {
        toast.error((cause as Error).message || t("บันทึกไม่สำเร็จ", "Could not save"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <main className={styles.page}>
        <p className={styles.note}>{t("เปิดแบบฟอร์มไม่สำเร็จ: ", "Could not open this form: ")}{loadError}</p>
      </main>
    );
  }
  if (draft === null) {
    return (
      <main className={styles.page}>
        <p className={styles.note}>{t("กำลังโหลด...", "Loading...")}</p>
      </main>
    );
  }

  const isAssessment = kind === "assessment";

  // The number each row wears, or null for the rows that are not questions.
  // ponytail: counts back over the list per row; a form is a few dozen rows, so a running counter
  // is only worth it if one ever runs to hundreds.
  const questionNumbers = draft.items.map(
    (item, index) =>
      isBlockType(item.type)
        ? null
        : draft.items.slice(0, index + 1).filter((row) => !isBlockType(row.type)).length,
  );

  // What is wrong with the draft as it stands, and how to say it. Recomputed every render rather
  // than stored, so a field stops complaining the moment it is put right.
  const issues = showIssues ? validateDraft(draft, kind, false) : [];
  const issueText: Record<DraftIssueCode, string> = {
    NAME_REQUIRED: t("ต้องตั้งชื่อฟอร์ม", "The form needs a name"),
    PASS_RANGE: t("เกณฑ์ผ่านต้องอยู่ระหว่าง 0 ถึง 100", "The passing score must be between 0 and 100"),
    TIME_POSITIVE: t("เวลาทำต้องเป็นจำนวนนาทีมากกว่า 0", "The time limit must be a whole number of minutes above zero"),
    NEED_QUESTION: t("ต้องมีคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่", "Add at least one question before publishing"),
    TEXT_REQUIRED: t("ยังไม่ได้พิมพ์คำถาม", "This question has no text"),
    MIN_OPTIONS: t("คำถามตัวเลือกต้องมีอย่างน้อย 2 ตัวเลือก", "A choice question needs at least two options"),
    OPTION_TEXT: t("มีตัวเลือกที่ยังว่างอยู่", "One of the options is still blank"),
    ONE_CORRECT: t("เลือกเฉลยให้ได้ 1 ข้อพอดี", "Mark exactly one option as the answer"),
    SOME_CORRECT: t("คำถามหลายตัวเลือกต้องมีเฉลยอย่างน้อย 2 ข้อ", "A multiple choice question needs at least two answers"),
    RATING_FIVE: t("คะแนน 1-5 ต้องมี 5 ตัวเลือกพอดี", "A rating question has exactly five options"),
    SCORE_POSITIVE: t("คะแนนของข้อนี้ต้องมากกว่า 0", "This question needs a score above zero"),
    GRID_AXES: t("ตารางต้องมีทั้งแถวและคอลัมน์", "A grid needs both rows and columns"),
  };
  const issueOf = (field: string) => {
    const found = issues.find((issue) => issue.field === field);
    return found === undefined ? null : issueText[found.code];
  };
  const issuesOf = (field: string) => issues.filter((issue) => issue.field === field).map((issue) => issueText[issue.code]);

  // Sections and their branch targets, on the shared helpers both old editors use.
  const rowTypes = draft.items.map((item) => item.type);
  const sectionOfRow = sectionIndexPerRow(rowTypes);
  const totalSections = sectionCountOf(rowTypes);
  /** A branch may only jump forward, which is what keeps the path through the form acyclic. */
  const forwardTargetsFrom = (index: number) =>
    Array.from({ length: totalSections }, (unused, offset) => offset + 1).filter(
      (target) => target > (sectionOfRow[index] ?? 1),
    );
  const branchSelect = (value: number | null, index: number, onPick: (target: number | null) => void) => (
    <select
      value={value ?? ""}
      onChange={(event) => onPick(event.target.value === "" ? null : Number(event.target.value))}
    >
      <option value="">{fallThroughLabel(sectionOfRow[index] ?? 1, totalSections, language === "th")}</option>
      <option value={SUBMIT_SECTION}>{t("ส่งแบบฟอร์ม (จบที่นี่)", "Submit form (end here)")}</option>
      {forwardTargetsFrom(index).map((target) => (
        <option key={target} value={target}>
          {t(`ไปยังส่วนที่ ${target}`, `Go to section ${target}`)}
        </option>
      ))}
    </select>
  );
  /**
   * A branch that jumps over a section. The questions in the section nobody reaches still count
   * toward the score, so a learner on that path cannot reach 100% - the author is the only person
   * who can decide whether that is what they meant.
   */
  const skipsASection = draft.items.some((item, index) =>
    [item.nextSection, ...item.options.map((option) => option.nextSection)].some(
      (target) => target !== null && target > (sectionOfRow[index] ?? 1) + 1,
    ),
  );
  // A grid is worth the sum of its rows, exactly as the write mapping and the service compute it.
  // Reading the typed score instead reported a grid as one point however its rows were marked.
  const scoreOf = (item: DraftItem) =>
    isBlockType(item.type)
      ? 0
      : isGridType(item.type)
        ? Number(gridTotalScore(item.options.filter((choice) => choice.axis === "ROW").map((row) => row.score)))
        : Number(item.score) || 0;
  const totalScore = draft.items.reduce((sum, item) => sum + scoreOf(item), 0);

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <button type="button" className={styles.iconButton} onClick={() => router.push(`/forms/${kind}`)}>
            <ChevronLeft size={16} /> {t("กลับ", "Back")}
          </button>
          {/* Undo and redo walk whole drafts, so they cannot disagree with what they are undoing. */}
          <button
            type="button"
            className={styles.iconOnly}
            title={t("ย้อนการแก้ไข", "Undo")}
            aria-label={t("ย้อนการแก้ไข", "Undo")}
            disabled={!canUndo(history)}
            onClick={() => dispatch({ type: "undo" })}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className={styles.iconOnly}
            title={t("ทำซ้ำการแก้ไข", "Redo")}
            aria-label={t("ทำซ้ำการแก้ไข", "Redo")}
            disabled={!canRedo(history)}
            onClick={() => dispatch({ type: "redo" })}
          >
            <RotateCw size={16} />
          </button>
        </div>

        <div className={styles.topRight}>
          <button type="button" className={styles.iconButton} onClick={() => setIsPreviewOpen(true)}>
            <Eye size={16} /> {t("ดูมุมมองผู้เรียน", "Preview as learner")}
          </button>
          {/* A published form is finished. Editing one in place would change the questions under
              the people already answering it, so the way on is a new version, not a save. */}
          {isForeign ? null : isLive ? (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy}
                onClick={() => void changeLifecycle("RETIRED")}
              >
                {t("ปลดระวาง", "Retire")}
              </button>
              <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void startNewVersion()}>
                <FileText size={15} /> {t("สร้างเวอร์ชันใหม่", "New version")}
              </button>
            </>
          ) : lifecycle === "RETIRED" ? (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy}
                onClick={() => void persist("DRAFT")}
              >
                {t("บันทึก", "Save")}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={busy}
                onClick={() => void changeLifecycle("LIVE")}
              >
                <Check size={15} /> {t("เปิดใช้อีกครั้ง", "Publish again")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy}
                onClick={() => void persist("DRAFT")}
              >
                {t("บันทึก", "Save")}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={busy}
                onClick={() => void persist("PUBLISH")}
              >
                <Check size={15} /> {t("เผยแพร่", "Publish")}
              </button>
            </>
          )}
        </div>
      </header>

      {isForeign ? (
        <p className={styles.lockedBanner}>{t("แบบฟอร์มนี้เป็นของหน่วยงานอื่น ดูได้อย่างเดียว แก้ไขไม่ได้", "This form belongs to another unit. It opens read-only.")}</p>
      ) : isLive ? (
        <p className={styles.lockedBanner}>
          {t(
            "แบบฟอร์มนี้เผยแพร่แล้ว แก้ไขไม่ได้ กดปุ่ม สร้างเวอร์ชันใหม่ เพื่อทำฉบับใหม่จากของเดิม",
            "This form is published and cannot be edited. Use New version to work from a copy of it.",
          )}
        </p>
      ) : lifecycle === "RETIRED" ? (
        <p className={styles.lockedBanner}>
          {t(
            "แบบฟอร์มนี้ปลดระวางแล้ว ไม่มีใครได้รับ แก้ไขและบันทึกได้ กดปุ่ม เปิดใช้อีกครั้ง เมื่อพร้อมใช้งาน",
            "This form is retired and reaches nobody. It can still be edited and saved; publish it again when it is ready.",
          )}
        </p>
      ) : null}

      {/* Everything inside is switched off at once while the form is live. */}
      <fieldset className={styles.sheet} disabled={isLive || isForeign}>
        <section className={styles.settingsCard}>
          {/* Starting from a form that already exists, which is how most of them are written. It
              sits above the title because it replaces everything below it, including the title. */}
          {isNew ? (
            <label className={styles.templatePicker}>
              <span>
                <ClipboardList size={15} />{" "}
                {isAssessment
                  ? t("สร้างจากแบบทดสอบที่มีอยู่", "Use an existing assessment as a template")
                  : t("สร้างจากแบบประเมินที่มีอยู่", "Use an existing evaluation as a template")}
              </span>
              <select value="" onChange={(event) => void applyTemplate(event.target.value)}>
                <option value="">{t("-- ไม่ใช้แม่แบบ (เริ่มจากหน้าว่าง) --", "-- No template (start blank) --")}</option>
                {templates.map((option) => (
                  <option key={option.id} value={option.id}>
                    [{option.code}] {option.name}
                  </option>
                ))}
              </select>
              <small>
                {t(
                  "ดึงคำถาม ตัวเลือก เฉลย คะแนน คำชี้แจง และการตั้งค่ามาให้ทั้งหมด รหัสฟอร์มออกใหม่เสมอ และฟอร์มต้นทางไม่ถูกแตะต้อง",
                  "Copies the questions, options, answer key, points, instructions and settings. The code is always generated fresh and the source form is untouched.",
                )}
              </small>
            </label>
          ) : null}

          <div className={styles.titleRow}>
            <RequiredIndicator
              isFilled={draft.name.trim() !== ""}
              title={draft.name.trim() === "" ? t("จำเป็นต้องกรอก", "Required field") : t("กรอกข้อมูลเรียบร้อยแล้ว", "Completed")}
            />
          <input
            className={styles.titleInput}
            value={draft.name}
            placeholder={isAssessment ? t("ชื่อแบบทดสอบ", "Assessment name") : t("ชื่อแบบประเมิน", "Evaluation name")}
            onChange={(event) => edit((current) => ({ ...current, name: event.target.value }))}
            aria-invalid={issueOf("name") !== null}
          />
          </div>
          {issueOf("name") ? <small className={styles.fieldError}>{issueOf("name")}</small> : null}
          <textarea
            className={styles.introInput}
            value={draft.intro}
            placeholder={t("คำชี้แจง (ไม่บังคับ)", "Instructions (optional)")}
            rows={2}
            onChange={(event) => edit((current) => ({ ...current, intro: event.target.value }))}
          />

          <div className={styles.settingsGrid}>
            {/* The server generates the code from the purpose, the scope and the company, and
                refuses any later change to it. Typing one here only ever produced a 409. */}
            <label>
              <span>{t("รหัสฟอร์ม", "Form code")}</span>
              <input
                value={draft.code}
                readOnly
                placeholder={t("ระบบออกรหัสให้เมื่อบันทึก", "Generated when the form is saved")}
              />
            </label>

            {/* Nobody picks a scope any more. A form belongs to whoever may change it: the centre
                writes the central ones, a factory writes its own, and neither writes the other's. */}
            <label>
              <span>{t("เจ้าของ", "Owner")}</span>
              <input
                value={
                  isCenter
                    ? t("ส่วนกลาง", "Central")
                    : user?.companyName ?? user?.companyCode ?? t("บริษัทของฉัน", "My company")
                }
                readOnly
              />
            </label>

            {isAssessment ? (
              <>
                {/* The purpose is part of the generated code, so it is settled when the form is
                    first written and the server refuses to move it afterwards. */}
                <label>
                  <span>{t("ใช้เป็น", "Used as")}</span>
                  <select
                    value={draft.purpose}
                    disabled={savedId !== ""}
                    title={savedId === "" ? undefined : t("เปลี่ยนไม่ได้ เพราะรหัสฟอร์มออกตามการใช้งานนี้", "Fixed: the form code is generated from this")}
                    onChange={(event) =>
                      edit((current) => ({ ...current, purpose: event.target.value as FormDraft["purpose"] }))
                    }
                  >
                    <option value="PRE_TEST">{t("ก่อนอบรม", "Pre-test")}</option>
                    <option value="POST_TEST">{t("หลังอบรม", "Post-test")}</option>
                    <option value="GENERAL">{t("ทั่วไป", "General")}</option>
                  </select>
                </label>
                <label>
                  <span>
                    {t("เกณฑ์ผ่าน (%)", "Passing score (%)")}
                    <RequiredIndicator
                      isFilled={issueOf("passingScorePercent") === null && draft.passingScorePercent.trim() !== ""}
                      title={t("จำเป็นต้องกรอก", "Required field")}
                    />
                  </span>
                  <input
                    value={draft.passingScorePercent}
                    aria-invalid={issueOf("passingScorePercent") !== null}
                    onChange={(event) =>
                      edit((current) => ({ ...current, passingScorePercent: event.target.value }))
                    }
                  />
                  {issueOf("passingScorePercent") ? <small className={styles.fieldError}>{issueOf("passingScorePercent")}</small> : null}
                </label>
                <label>
                  <span>{t("บันทึกเวอร์ชัน", "Version note")}</span>
                  <input
                    value={draft.versionNote}
                    maxLength={500}
                    placeholder={t("อธิบายว่าแก้อะไร (ไม่บังคับ)", "What changed (optional)")}
                    onChange={(event) => edit((current) => ({ ...current, versionNote: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{t("เวลาทำ (นาที)", "Time limit (minutes)")}</span>
                  <input
                    value={draft.timeLimitMinutes}
                    aria-invalid={issueOf("timeLimitMinutes") !== null}
                    placeholder={t("ไม่จำกัด", "No limit")}
                    onChange={(event) =>
                      edit((current) => ({ ...current, timeLimitMinutes: event.target.value }))
                    }
                  />
                  {issueOf("timeLimitMinutes") ? <small className={styles.fieldError}>{issueOf("timeLimitMinutes")}</small> : null}
                </label>
              </>
            ) : (
              <>
                <label>
                  <span>{t("ช่วงเวลา", "When")}</span>
                  <select
                    value={draft.timing}
                    onChange={(event) =>
                      edit((current) => ({ ...current, timing: event.target.value as FormDraft["timing"] }))
                    }
                  >
                    <option value="AFTER_TRAINING">{t("หลังอบรม", "After training")}</option>
                    <option value="FOLLOW_UP_30_DAYS">{t("ติดตามผล 30 วัน", "30-day follow-up")}</option>
                  </select>
                </label>
                {/* The respondent is not asked for here. Sections decide who answers what, and
                    the 30-day supervisor evaluation is sent from Training Record on the same form
                    the attendees answer, so the field settles nothing. Nothing in the services
                    branches on it either - it is a stored column and a list filter. The draft still
                    carries it, so an older form keeps the value it was written with. */}
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={draft.isAnonymous}
                    onChange={(event) => edit((current) => ({ ...current, isAnonymous: event.target.checked }))}
                  />
                  <span>{t("ไม่ระบุตัวตนผู้ตอบ", "Anonymous responses")}</span>
                </label>
              </>
            )}
          </div>
        </section>

        <div className={styles.itemsArea}>
          <p className={styles.scoreSummary}>
            {isAssessment
              ? t(
                  `${questionNumbers.filter((number) => number !== null).length} ข้อ · คะแนนรวม ${totalScore} คะแนน · ${totalSections} ส่วน`,
                  `${questionNumbers.filter((number) => number !== null).length} questions · ${totalScore} points · ${totalSections} sections`,
                )
              : t(
                  `${questionNumbers.filter((number) => number !== null).length} ข้อ · ${totalSections} ส่วน`,
                  `${questionNumbers.filter((number) => number !== null).length} questions · ${totalSections} sections`,
                )}
          </p>

          {issueOf("items") ? <p className={styles.fieldError}>{issueOf("items")}</p> : null}

          {skipsASection ? (
            <p className={styles.branchWarning} role="note">
              {t(
                "มีการข้ามส่วนด้วยการแตกสาขา คำถามในส่วนที่ถูกข้ามยังถูกนับเป็นตัวหารของคะแนนอยู่ ผู้เรียนที่เดินเส้นทางนั้นจะไม่มีทางได้คะแนนเต็ม 100%",
                "A branch skips a section. Questions in a skipped section still count toward the score denominator, so a learner on that path can never reach 100%.",
              )}
            </p>
          ) : null}

          <div className={styles.items}>
            {draft.items.map((item, index) => (
              <article
                key={item.id}
                ref={cardRef(item.id)}
                className={item.id === focusedItemId ? styles.itemCardOn : styles.itemCard}
                onFocus={() => setFocusedItemId(item.id)}
                onClick={() => setFocusedItemId(item.id)}
                // Dragging is on the card, started from its handle: making the whole card
                // draggable stops every text field inside it from being selectable with the mouse.
                draggable={draggingId === item.id}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  dragStartRef.current = draft;
                  setDraggingId(item.id);
                }}
                onDragOver={(event) => {
                  if (draggingId === null || draggingId === item.id) return;
                  event.preventDefault();
                  moveItemBefore(draggingId, item.id);
                }}
                onDragEnd={endDrag}
                onDrop={endDrag}
              >
                <div className={styles.itemHead}>
                  {/* The handle, not the card: pressing here is what arms the drag, so a click in
                      the question field still puts a cursor in it. */}
                  <span
                    className={styles.dragHandle}
                    title={t("ลากเพื่อสลับลำดับ", "Drag to reorder")}
                    aria-hidden="true"
                    onMouseDown={() => setDraggingId(item.id)}
                    onMouseUp={() => setDraggingId(null)}
                  >
                    ⠿
                  </span>
                  {/* Numbered as the learner will see it: a section break and a text block are not
                      questions, so they take no number and pass the next one on. A section wears
                      its ordinal instead, because that ordinal is what a branch target names. */}
                  {item.type === "SECTION_BREAK" ? (
                    <span className={styles.sectionTag}>
                      {t(`ส่วนที่ ${sectionOfRow[index]}`, `Section ${sectionOfRow[index]}`)}
                    </span>
                  ) : (
                    <span className={styles.itemNumber}>{questionNumbers[index] ?? "—"}</span>
                  )}
                  {isBlockType(item.type) ? null : (
                    <RequiredIndicator
                      isFilled={item.text.trim() !== ""}
                      title={item.text.trim() === "" ? t("จำเป็นต้องกรอก", "Required field") : t("กรอกข้อมูลเรียบร้อยแล้ว", "Completed")}
                    />
                  )}
                  <input
                    className={styles.itemText}
                    value={item.text}
                    aria-invalid={issuesOf(item.id).length > 0}
                    placeholder={
                      item.type === "SECTION_BREAK"
                        ? t("ชื่อส่วน", "Section title")
                        : item.type === "TEXT_BLOCK"
                          ? t("หัวข้อข้อความ", "Text title")
                          : t("คำถาม", "Question")
                    }
                    onChange={(event) => editItem(item.id, (current) => ({ ...current, text: event.target.value }))}
                  />
                  {/* A grid is a question type like any other, so it keeps the picker: hiding it
                      there left no way back to a plain question once one was chosen. Only a
                      section or a text block has nothing to pick. */}
                  {isBlockType(item.type) ? null : (
                    <select
                      className={styles.typeSelect}
                      value={item.type}
                      onChange={(event) => changeItemType(item.id, event.target.value as DraftItemType)}
                    >
                      {QUESTION_TYPES[kind].map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {isBlockType(item.type) ? (
                  <textarea
                    className={styles.itemDescription}
                    value={item.description}
                    rows={2}
                    placeholder={item.type === "SECTION_BREAK" ? t("คำอธิบายส่วน (ไม่บังคับ)", "Section description (optional)") : t("ข้อความ", "Text")}
                    onChange={(event) =>
                      editItem(item.id, (current) => ({ ...current, description: event.target.value }))
                    }
                  />
                ) : null}

                {/* Where the form goes after this section. Naming the destination on the default
                    choice is the point: a section an author thinks ends here otherwise falls
                    through into whatever follows it, which nobody notices until a learner does. */}
                {item.type === "SECTION_BREAK" ? (
                  <div className={styles.branchRow}>
                    <label className={styles.branchLabel}>
                      {t("หลังส่วนนี้", "After this section")}
                      {branchSelect(item.nextSection, index, (target) =>
                        editItem(item.id, (current) => ({ ...current, nextSection: target })),
                      )}
                    </label>
                  </div>
                ) : null}

                {/* A grid asks the same columns about every row, so it is edited as two lists and
                    read as a table. On an assessment each row carries its own points and its own
                    correct column, which is how a grid is marked - per row, all or nothing. */}
                {isGridType(item.type) ? (
                  <GridEditor
                    item={item}
                    isAssessment={isAssessment}
                    onChange={(change) => editItem(item.id, change)}
                  />
                ) : null}

                {item.options.length > 0 && !isGridType(item.type) ? (
                  <ul className={styles.options}>
                    {item.options.map((choice, choiceIndex) => (
                      <li key={choice.id} data-correct={isAssessment && choice.isCorrect ? "" : undefined}>
                        {/* Only an assessment has a right answer. On an evaluation there is nothing
                            to be right about, so the control is not there to tick by mistake.
                            The word is on the control: a bare radio beside a text box reads as the
                            learner's own answer button rather than as the answer key. */}
                        {isAssessment ? (
                          <label className={styles.correctToggle}>
                            <input
                              type={item.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                              name={`correct-${item.id}`}
                              checked={choice.isCorrect}
                              onChange={(event) =>
                                editItem(item.id, (current) => ({
                                  ...current,
                                  options: current.options.map((other) =>
                                    other.id === choice.id
                                      ? { ...other, isCorrect: event.target.checked }
                                      : item.type === "MULTIPLE_CHOICE"
                                        ? other
                                        : { ...other, isCorrect: false },
                                  ),
                                }))
                              }
                            />
                            <span>
                              {String.fromCharCode(65 + choiceIndex)}
                              {choice.isCorrect ? ` · ${t("เฉลย", "Answer")}` : ""}
                            </span>
                          </label>
                        ) : (
                          <span className={styles.bullet} aria-hidden="true" />
                        )}
                        <input
                          className={styles.optionText}
                          value={choice.text}
                          onChange={(event) =>
                            editItem(item.id, (current) => ({
                              ...current,
                              options: current.options.map((other) =>
                                other.id === choice.id ? { ...other, text: event.target.value } : other,
                              ),
                            }))
                          }
                        />
                        {/* True/false and a rating scale are the options they are born with: the
                            services refuse a third answer and a sixth grade. */}
                        {item.type === "TRUE_FALSE" || item.type === "RATING" ? null : (
                        <button
                          type="button"
                          className={styles.iconOnly}
                          title={t("ลบตัวเลือก", "Remove option")}
                          onClick={() =>
                            editItem(item.id, (current) => ({
                              ...current,
                              options: current.options.filter((other) => other.id !== choice.id),
                            }))
                          }
                        >
                          <X size={14} />
                        </button>
                        )}
                      </li>
                    ))}
                    {item.type === "TRUE_FALSE" || item.type === "RATING" ? null : (
                    <li>
                      <button
                        type="button"
                        className={styles.addOption}
                        onClick={() =>
                          editItem(item.id, (current) => ({
                            ...current,
                            options: [
                              ...current.options,
                              {
                                id: `${current.id}-opt-${current.options.length + 1}-${Date.now()}`,
                                text: t(`ตัวเลือกที่ ${current.options.length + 1}`, `Option ${current.options.length + 1}`),
                                isCorrect: false,
                                axis: null,
                                nextSection: null,
                                score: "0",
                                correctColumnOrders: [],
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={14} /> {t("เพิ่มตัวเลือก", "Add option")}
                      </button>
                    </li>
                    )}
                  </ul>
                ) : null}

                {/* Google Forms' "go to section based on answer": only a single choice can carry
                    one, because only a single choice has exactly one destination. */}
                {item.type === "SINGLE_CHOICE" && forwardTargetsFrom(index).length > 0 ? (
                  <div className={styles.branchRow}>
                    {item.options.map((choice) =>
                      choice.text.trim() === "" ? null : (
                        <label className={styles.branchLabel} key={`${item.id}-branch-${choice.id}`}>
                          {`"${choice.text}" →`}
                          {branchSelect(choice.nextSection, index, (target) =>
                            editItem(item.id, (current) => ({
                              ...current,
                              options: current.options.map((other) =>
                                other.id === choice.id ? { ...other, nextSection: target } : other,
                              ),
                            })),
                          )}
                        </label>
                      ),
                    )}
                  </div>
                ) : null}

                <div className={styles.itemFoot}>
                  {/* A grid owns its score: each row carries its own points and the question is
                      their sum, so there is nothing here to type. */}
                  {isAssessment && !isBlockType(item.type) ? (
                    <label className={styles.scoreLabel}>
                      <span>{t("คะแนน", "Points")}</span>
                      <input
                        value={isGridType(item.type) ? String(scoreOf(item)) : item.score}
                        readOnly={isGridType(item.type)}
                        title={isGridType(item.type) ? t("รวมจากคะแนนของแต่ละแถว", "The sum of the row scores") : undefined}
                        onChange={(event) =>
                          editItem(item.id, (current) => ({ ...current, score: event.target.value }))
                        }
                      />
                    </label>
                  ) : null}
                  {isBlockType(item.type) ? null : (
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        onChange={(event) =>
                          editItem(item.id, (current) => ({ ...current, isRequired: event.target.checked }))
                        }
                      />
                      <span>{t("บังคับตอบ", "Required")}</span>
                    </label>
                  )}
                  <span className={styles.footSpacer} />
                  <button type="button" className={styles.iconOnly} title={t("เลื่อนขึ้น", "Move up")} onClick={() => moveItem(item.id, -1)}>
                    ↑
                  </button>
                  <button type="button" className={styles.iconOnly} title={t("เลื่อนลง", "Move down")} onClick={() => moveItem(item.id, 1)}>
                    ↓
                  </button>
                  <button type="button" className={styles.iconOnly} title={t("ทำสำเนา", "Duplicate")} onClick={() => duplicateItem(item.id)}>
                    <FileText size={15} />
                  </button>
                  <button type="button" className={styles.iconOnly} title={t("ลบ", "Delete")} onClick={() => removeItem(item.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Everything wrong with this card, under the card that is wrong. */}
                {issuesOf(item.id).map((message) => (
                  <small className={styles.fieldError} key={message}>
                    {message}
                  </small>
                ))}
              </article>
            ))}
          </div>

          {/* The same strip both old editors use, so the three kinds of row are added the one way. */}
          <FormItemToolbar anchorTop={anchorTop} onAdd={addItem} disabled={busy} />
        </div>
      </fieldset>

      {isPreviewOpen ? (
        <div className={styles.overlay} onClick={() => setIsPreviewOpen(false)}>
          <div className={styles.previewCard} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.previewClose} onClick={() => setIsPreviewOpen(false)}>
              <X size={16} />
            </button>
            <FormPreviewRunner
              title={draft.name || (isAssessment ? t("แบบทดสอบ", "Assessment") : t("แบบประเมิน", "Evaluation"))}
              instructions={draft.intro || null}
              meta={
                isAssessment
                  ? `เกณฑ์ผ่าน ${draft.passingScorePercent}%${
                      draft.timeLimitMinutes ? ` · เวลา ${draft.timeLimitMinutes} นาที` : ""
                    }`
                  : draft.isAnonymous
                    ? t("ไม่ระบุตัวตนผู้ตอบ", "Anonymous responses")
                    : null
              }
              items={toPreviewItems(draft)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
