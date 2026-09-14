"use client";

import React, { useState } from "react";
import styles from "./AddActivityButton.module.css";
import { ActivityFormModal } from "./ActivityFormModal";
import { ActivityPostSaveDialog } from "./ActivityPostSaveDialog";
import type { CourseActivity } from "../../../../api/course-activities/route";

export interface AddActivityButtonProps {
  onClick?: () => void;
  onSuccess?: (newActivityId?: string) => void;
  isThai?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export const AddActivityButton: React.FC<AddActivityButtonProps> = ({
  onClick,
  onSuccess,
  isThai = true,
  disabled = false,
  className,
  title,
}) => {
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isPostSaveOpen, setIsPostSaveOpen] = useState<boolean>(false);
  const [savedActivityId, setSavedActivityId] = useState<string>("");
  const [savedActivity, setSavedActivity] = useState<CourseActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<CourseActivity | null>(null);

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    setEditingActivity(null);
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = (
    newActivityId?: string,
    isEdit?: boolean,
    activityData?: CourseActivity
  ) => {
    setIsFormModalOpen(false);
    setEditingActivity(null);

    if (newActivityId && !isEdit) {
      setSavedActivityId(newActivityId);
      setSavedActivity(activityData || null);
      setIsPostSaveOpen(true);
    } else {
      onSuccess?.(newActivityId);
    }
  };

  const handleBackToEdit = (activity: CourseActivity) => {
    setIsPostSaveOpen(false);
    setEditingActivity(activity);
    setIsFormModalOpen(true);
  };

  const handlePostSaveClose = () => {
    setIsPostSaveOpen(false);
    setSavedActivity(null);
    onSuccess?.(savedActivityId);
  };

  return (
    <>
      <button
        type="button"
        className={className ? `${styles.addActivityBtn} ${className}` : styles.addActivityBtn}
        onClick={handleClick}
        disabled={disabled}
        title={title || (isThai ? "เพิ่มกิจกรรมใหม่" : "Add Activity")}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{isThai ? "เพิ่มกิจกรรม" : "Add Activity"}</span>
      </button>

      {/* Built-in Self-Contained Form Modal */}
      {!onClick && (
        <>
          <ActivityFormModal
            isOpen={isFormModalOpen}
            activityToEdit={editingActivity}
            onClose={() => {
              setIsFormModalOpen(false);
              setEditingActivity(null);
            }}
            onSuccess={handleFormSuccess}
            isThai={isThai}
          />
          <ActivityPostSaveDialog
            isOpen={isPostSaveOpen}
            activityId={savedActivityId}
            activity={savedActivity}
            onClose={handlePostSaveClose}
            onSuccess={handlePostSaveClose}
            onBackToEdit={handleBackToEdit}
            isThai={isThai}
          />
        </>
      )}
    </>
  );
};

export default AddActivityButton;
