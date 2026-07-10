import { Component } from "react";

import { Sentry } from "../sentry.js";

// Keeps a broken application modal from taking down the whole board.
export default class ModalErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    Sentry.captureException(error, { extra: info });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="overlay" onClick={this.props.onClose} role="presentation">
          <div
            className="modal modal-error"
            role="alertdialog"
            aria-labelledby="modal-error-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="modal-error-title">Något gick fel</h2>
            <p className="muted">
              Ansökningsrutan kunde inte visas. Dina ansökningar syns fortfarande — stäng
              och försök igen.
            </p>
            <div className="modal-actions">
              <button type="button" onClick={this.props.onClose}>
                Stäng
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => window.location.reload()}
              >
                Ladda om sidan
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
