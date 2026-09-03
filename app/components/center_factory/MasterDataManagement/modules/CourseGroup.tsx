"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { createCourseGroup, deleteCourseGroup, listCourseGroups, updateCourseGroup } from "../../../../lib/courseGroups/client";
import type { CourseGroupRecord, CourseGroupStatus } from "../../../../lib/courseGroups/types";
import styles from "./CourseGroup.module.css";
export const courseGroupModule = { title: "Course Group", subtitle: "Course group", description: "Maintain course group master data for course classification and reporting." } as const;
type Mode = "idle" | "new" | "edit"; type Draft = { code: string; name: string; status: CourseGroupStatus }; const emptyDraft: Draft = { code: "", name: "", status: "ACTIVE" };
export default function CourseGroup() {
  const user = useAuthenticatedUser(); const canWrite = user?.roleCode === "HRD_CENTER"; const confirm = useConfirm(); const notice = useNotice(); const toast = useToast();
  const [items, setItems] = useState<CourseGroupRecord[]>([]); const [selectedId, setSelectedId] = useState(""); const [draft, setDraft] = useState<Draft>(emptyDraft); const [mode, setMode] = useState<Mode>("idle"); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const selected = useMemo(() => items.find((item) => item.courseGroupId === selectedId) ?? null, [items, selectedId]);
  const load = useCallback(async () => { setBusy(true); setMessage(""); try { const result = await listCourseGroups(); setItems(result.items); setSelectedId((current) => result.items.some((item) => item.courseGroupId === current) ? current : ""); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load course groups"); } finally { setBusy(false); } }, []);
  useEffect(() => {
    let active = true;
    void listCourseGroups().then((result) => {
      if (active) setItems(result.items);
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "Unable to load course groups");
    });
    return () => { active = false; };
  }, []);
  const save = async () => {
    if (!canWrite) return;
    const missingFields: string[] = [];
    if (!draft.name.trim()) missingFields.push("ชื่อกลุ่มหลักสูตร (Course Group Name)");
    if (!draft.code.trim()) missingFields.push("รหัสกลุ่มหลักสูตร (Group ID / Code)");
    if (missingFields.length > 0) { await notice({ missingFields }); return; }
    setBusy(true); setMessage(""); try { if (mode === "edit" && selected) await updateCourseGroup(selected.courseGroupId, draft); else await createCourseGroup(draft); setMode("idle"); setDraft(emptyDraft); await load(); toast.success(`บันทึกกลุ่มหลักสูตร ${draft.code} แล้ว / Course group saved`); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save course group"); } finally { setBusy(false); } };
  const remove = async () => { if (!canWrite || !selected) return; if (!(await confirm({ message: { th: `ยืนยันที่จะลบกลุ่มหลักสูตร ${selected.code} หรือไม่?`, en: `Confirm deleting course group ${selected.code}?` }, danger: true }))) return; setBusy(true); setMessage(""); try { const removedCode = selected.code; await deleteCourseGroup(selected.courseGroupId); setSelectedId(""); setMode("idle"); await load(); toast.success(`ลบกลุ่มหลักสูตร ${removedCode} แล้ว / Course group deleted`); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete course group"); } finally { setBusy(false); } };
  return (
    <section className={styles.page} aria-label="Course Group management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker} translate="no">{courseGroupModule.subtitle}</p>
          <h2 translate="no">{courseGroupModule.title}</h2>
          <p>{canWrite ? courseGroupModule.description : "Shared course groups — read only"}</p>
        </div>
      </section>
      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <span className={styles.listMeta} translate="no">{items.length} groups</span>
          <button
            className={styles.newButton}
            type="button"
            disabled={!canWrite || busy}
            onClick={() => {
              setSelectedId("");
              setDraft(emptyDraft);
              setMode("new");
              setMessage("");
            }}
          >
            เพิ่ม
          </button>
          <button
            className={styles.editButton}
            type="button"
            disabled={!canWrite || !selected || busy}
            onClick={() => {
              if (selected) {
                setDraft({ code: selected.code, name: selected.name, status: selected.status });
                setMode("edit");
                setMessage("");
              }
            }}
          >
            แก้ไข
          </button>
          <button
            className={styles.deleteButton}
            type="button"
            disabled={!canWrite || !selected || busy}
            onClick={() => void remove()}
          >
            ลบ
          </button>
          <button
            className={styles.refreshButton}
            type="button"
            disabled={busy}
            onClick={() => void load()}
          >
            รีเฟรช
          </button>
          <button
            className={styles.exportButton}
            type="button"
            onClick={() => toast.info(`เตรียมส่งออกกลุ่มหลักสูตร ${items.length} รายการ / Export ready: ${items.length} course groups`)}
          >
            Export
          </button>
        </div>

        {mode !== "idle" ? (
          <div className={styles.editor}>
            <label>
              Course Group Name
              <input
                maxLength={255}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Quality"
                translate="no"
              />
            </label>
            <label>
              Group ID / Code
              <input
                maxLength={2}
                disabled={mode === "edit" && (selected?.lastCourseNumber ?? 0) > 0}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                placeholder="QT"
                translate="no"
              />
            </label>
            <label>
              Status
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as CourseGroupStatus })}
                translate="no"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            {mode === "edit" ? (
              <label>
                Last Course Number
                <input readOnly value={selected?.lastCourseNumber ?? 0} translate="no" />
              </label>
            ) : null}
            <button className={styles.saveButton} type="button" disabled={busy} onClick={() => void save()}>
              Save
            </button>
            <button className={styles.cancelButton} type="button" disabled={busy} onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        ) : null}

        {message ? (
          <p className={styles.exportMessage} role="status">
            {message}
          </p>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.courseGroupTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Course Group</th>
                <th>Group ID / Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody translate="no">
              {items.map((item, index) => (
                <tr
                  className={item.courseGroupId === selectedId ? styles.selectedRow : undefined}
                  key={item.courseGroupId}
                  onClick={() => {
                    setSelectedId(item.courseGroupId);
                    setMessage("");
                  }}
                >
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.code}</td>
                  <td>
                    <span className={styles.statusPill}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
