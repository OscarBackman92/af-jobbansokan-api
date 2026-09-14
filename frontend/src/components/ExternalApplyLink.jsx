import { isModifiedClick, openBehind } from "../adUrl.js";

/**
 * Real link (copy / middle-click still work) whose ordinary click stays
 * on Jobbdjungeln and opens the employer page in a background tab.
 */
export default function ExternalApplyLink({
  href,
  className,
  children,
  onClick,
}) {
  if (!href) return null;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || isModifiedClick(event)) return;
        event.preventDefault();
        openBehind(href);
      }}
    >
      {children}
    </a>
  );
}
