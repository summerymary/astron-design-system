import { Children, cloneElement, isValidElement, useId } from 'react';
import type { LabelHTMLAttributes, ReactElement, ReactNode } from 'react';

/** Shared label, requirement, hint and error for native and specialized controls. */
export function Field({
  label,
  required,
  hint,
  error,
  children,
  className = '',
  ...props
}: Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const description = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <label
      {...props}
      className={[...new Set(['form-field', error ? 'field-error' : '', ...className.split(' ')])]
        .filter(Boolean)
        .join(' ')}
      data-ui="field"
    >
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {Children.map(children, (child) => {
        if (!isValidElement(child) || !description) return child;
        const control = child as ReactElement<{
          'aria-describedby'?: string;
          'aria-invalid'?: boolean;
        }>;
        return cloneElement(control, {
          'aria-describedby': [control.props['aria-describedby'], description]
            .filter(Boolean)
            .join(' '),
          ...(error ? { 'aria-invalid': true } : {}),
        });
      })}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-message-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
