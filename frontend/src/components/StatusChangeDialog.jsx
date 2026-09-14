import ModalCloseButton from "./ModalCloseButton.jsx";
import ModalOverlay, { useModalClose } from "./ModalOverlay.jsx";
import { STATUS_LABELS } from "../statuses.js";

export default function StatusChangeDialog({
  summary,
  nextStatus,
  pendingDate,
  saving = false,
  onPendingDateChange,
  onConfirm,
  onClose,
}) {
  return (
    <ModalOverlay
      onClose={onClose}
      onBeforeClose={() => !saving}
      className="modal status-change-modal"
      labelledBy="status-change-title"
    >
      <StatusChangeDialogBody
        summary={summary}
        nextStatus={nextStatus}
        pendingDate={pendingDate}
        saving={saving}
        onPendingDateChange={onPendingDateChange}
        onConfirm={onConfirm}
      />
    </ModalOverlay>
  );
}

function StatusChangeDialogBody({
  summary,
  nextStatus,
  pendingDate,
  saving = false,
  onPendingDateChange,
  onConfirm,
}) {
  const requestClose = useModalClose();
  const nextLabel = STATUS_LABELS[nextStatus] || nextStatus;

  return (
    <>
      <div className="modal-head">
        <div className="modal-head-text">
          <h2 id="status-change-title">Byt status</h2>
          <p className="muted">
            {summary}
            {" → "}
            {nextLabel}
          </p>
        </div>
        <ModalCloseButton />
      </div>
      <label htmlFor="applied-status-change-date">
        Datum för statusbytet
        <input
          id="applied-status-change-date"
          type="date"
          value={pendingDate}
          disabled={saving}
          onChange={(e) => onPendingDateChange(e.target.value)}
        />
      </label>
      <div className="row-gap" style={{ marginTop: "1rem" }}>
        <button type="button" onClick={onConfirm} disabled={saving}>
          {saving ? "Sparar…" : "Bekräfta"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={requestClose}
          disabled={saving}
        >
          Avbryt
        </button>
      </div>
    </>
  );
}
