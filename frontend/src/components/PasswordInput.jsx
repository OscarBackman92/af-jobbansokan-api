import { useState } from "react";

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 5c-5.5 0-9.5 4.5-10.7 7 1.2 2.5 5.2 7 10.7 7s9.5-4.5 10.7-7C21.5 9.5 17.5 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.3 2.3 2 3.6l2.1 2.1C3.1 7.2 1.6 9.2.3 12c1.3 2.8 5.3 7 11.7 7 2.2 0 4.2-.6 5.9-1.5l2.5 2.5 1.3-1.3L3.3 2.3ZM12 17a4.8 4.8 0 0 1-4.8-4.8c0-.7.2-1.4.5-2L9.6 14c.6.6 1.3.9 2.1.9 1 0 1.9-.5 2.4-1.3l1.9 1.9A4.7 4.7 0 0 1 12 17Zm7.2-2.2-1.6-1.6a6.8 6.8 0 0 0 1.4-2.2c-1.1-2.3-4.5-5.5-8.9-5.5-.9 0-1.7.1-2.5.4l-1.8-1.8C7.5 4.2 9.7 4 12 4c6.4 0 10.4 4.2 11.7 7-.6 1.3-1.7 2.9-3.2 4.2l1.7 1.6Z"
      />
    </svg>
  );
}

export default function PasswordInput({
  value,
  onChange,
  autoComplete,
  required = false,
  id,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Dölj lösenord" : "Visa lösenord"}
        aria-pressed={visible}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
