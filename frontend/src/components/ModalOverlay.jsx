import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CLOSE_MS = 220;

const ModalCloseContext = createContext(null);

export function useModalClose() {
  const close = useContext(ModalCloseContext);
  if (!close) {
    throw new Error("useModalClose must be used within ModalOverlay");
  }
  return close;
}

export default function ModalOverlay({
  onClose,
  onBeforeClose,
  children,
  className = "modal",
  overlayClassName = "overlay",
  dialogRef,
  labelledBy,
}) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    if (onBeforeClose?.() === false) return;
    setClosing(true);
    window.setTimeout(() => onClose(), CLOSE_MS);
  }, [closing, onBeforeClose, onClose]);

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return createPortal(
    <ModalCloseContext.Provider value={requestClose}>
      <div
        className={`${overlayClassName}${closing ? " overlay--closing" : ""}`}
        onClick={requestClose}
        role="presentation"
      >
        <div
          className={
            closing ? "modal-shell modal-shell--closing" : "modal-shell"
          }
        >
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
        </div>
      </div>
    </ModalCloseContext.Provider>,
    document.body
  );
}
