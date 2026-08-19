import { useEffect, useRef } from "react";

import ModalOverlay, { useModalClose } from "./ModalOverlay.jsx";

function ConfirmDialogBody({
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmClassName,
  onConfirm,
  labelledBy,
}) {
  const requestClose = useModalClose();

  return (
    <>
      <h2 id={labelledBy}>{title}</h2>
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={requestClose}>
          {cancelLabel}
        </button>
        <button type="button" className={confirmClassName} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </>
  );
}

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
    return () => {
      previous?.focus?.();
    };
  }, []);

  return (
    <ModalOverlay
      onClose={onCancel}
      className="modal confirm-modal"
      dialogRef={dialogRef}
      labelledBy={labelledBy}
    >
      <ConfirmDialogBody
        title={title}
        message={message}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        confirmClassName={confirmClassName}
        onConfirm={onConfirm}
        labelledBy={labelledBy}
      />
    </ModalOverlay>
  );
}
