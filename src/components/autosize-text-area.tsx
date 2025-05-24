import { TextareaHTMLAttributes } from "react";

interface AutosizeTextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
}

export function AutosizeTextArea({
  ...otherProps
}: AutosizeTextAreaProps) {
  const rows = Math.max(2, otherProps.value == null ? 2 : String(otherProps.value).split("\n").length);
  return (
    <textarea {...otherProps} rows={rows} />
  );
}