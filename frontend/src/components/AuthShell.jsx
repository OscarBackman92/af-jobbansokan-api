import AuthIntro from "./AuthIntro.jsx";

export default function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-page-inner">
        <AuthIntro />
        <div className="auth-page-form">{children}</div>
      </div>
    </div>
  );
}
