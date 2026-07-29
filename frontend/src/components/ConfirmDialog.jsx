import { useEffect, useRef } from "react";

import ModalOverlay from "./ModalOverlay.jsx";

/**
 * Themed confirm dialog — replaces window.confirm for dirty/discard flows.
 */
export default function ConfirmDialog({
  title = "Osparade ändringar",
  message,
  cancelLabel = "Fortsätt redigera",
  confirmLabel = "Kasta ändringar",
  confirmClassName = "danger",
  onCancel,
  onConfirm,
  labelledBy = "confirm-dialog-title",
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onCancel]);

  return (
    <ModalOverlay
      onClose={onCancel}
      className="modal confirm-modal"
      dialogRef={dialogRef}
      labelledBy={labelledBy}
    >
      <h2 id={labelledBy}>{title}</h2>
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={confirmClassName} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}
