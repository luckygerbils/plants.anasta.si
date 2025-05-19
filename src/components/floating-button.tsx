import React, { PropsWithChildren } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant,
}

type Variant = "primary" | "secondary" | "danger" | "warning" | "save";

export function FloatingButton({
  children,
  variant="primary",
  ...otherProps
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type="button"
      className={[`floating-button`, variant].join(" ")}
      {...otherProps}
    >
      {children}
    </button>
  );
}