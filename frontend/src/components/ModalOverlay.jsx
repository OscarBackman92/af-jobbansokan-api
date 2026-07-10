import { createPortal } from "react-dom";
import { useEffect } from "react";

export default function ModalOverlay({
  onClose,
  children,
  className = "modal",
  overlayClassName = "overlay",
  dialogRef,
  labelledBy,
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div className={overlayClassName} onClick={onClose} role="presentation">
      <div
        className={className}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
