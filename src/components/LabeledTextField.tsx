import { ErrorMessage, useField, useFormikContext } from "formik";
import type { PropsWithoutRef } from "react";
import { forwardRef } from "react";
import type { B3Size } from "@/components/elements";
import { Input, StyledLabelSpan } from "@/components/elements";
import { InlineError } from "@/components/inline_error";

interface LabeledTextFieldProps
  extends PropsWithoutRef<React.JSX.IntrinsicElements["input"]> {
  name: string;
  label: string;
  type?: "text" | "password" | "email" | "number" | "url";
  _size?: B3Size;
  outerProps?: PropsWithoutRef<React.JSX.IntrinsicElements["div"]>;
}

export const LabeledTextField = forwardRef<
  HTMLInputElement,
  LabeledTextFieldProps
>(
  (
    { name, label, _size = "sm", outerProps, ...props }: LabeledTextFieldProps,
    ref,
  ) => {
    const [input] = useField(name);
    const { isSubmitting } = useFormikContext();

    return (
      <div className="pb-2 space-y-2" {...outerProps}>
        <label>
          <div className="pb-1">
            <StyledLabelSpan size={_size}>{label}</StyledLabelSpan>
          </div>
          <Input
            spellCheck="false"
            autoCapitalize="false"
            disabled={isSubmitting}
            _size={_size}
            {...input}
            {...props}
            ref={ref}
          />
        </label>

        <ErrorMessage name={name} component={InlineError} />
      </div>
    );
  },
);
