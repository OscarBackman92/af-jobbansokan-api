import { useModalClose } from "./ModalOverlay.jsx";

export default function ModalCloseButton({
  className = "secondary small modal-close",
  label = "✕",
  children,
  ...props
}) {
  const requestClose = useModalClose();
  return (
    <button
      type="button"
      className={className}
      onClick={requestClose}
      aria-label="Stäng"
      {...props}
    >
      {children ?? label}
    </button>
  );
}
