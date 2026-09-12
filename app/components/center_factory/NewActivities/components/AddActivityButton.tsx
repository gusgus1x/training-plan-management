"use client";

import React, { useState } from "react";
import styles from "./AddActivityButton.module.css";
import { ActivityFormModal } from "./ActivityFormModal";
import { ActivityPostSaveDialog } from "./ActivityPostSaveDialog";

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

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = (newActivityId?: string) => {
    setIsFormModalOpen(false);
    if (newActivityId) {
      setSavedActivityId(newActivityId);
      setIsPostSaveOpen(true);
    } else {
      onSuccess?.();
    }
  };

  const handlePostSaveClose = () => {
    setIsPostSaveOpen(false);
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
            onClose={() => setIsFormModalOpen(false)}
            onSuccess={handleFormSuccess}
            isThai={isThai}
          />
          <ActivityPostSaveDialog
            isOpen={isPostSaveOpen}
            activityId={savedActivityId}
            onClose={handlePostSaveClose}
            onSuccess={handlePostSaveClose}
            isThai={isThai}
          />
        </>
      )}
    </>
  );
};

export default AddActivityButton;
