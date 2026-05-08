import { InfoCircledIcon } from "@radix-ui/react-icons";

export function InlineError({ children }: React.PropsWithChildren<unknown>) {
  return (
    <div
      role="alert"
      className="pt-1 text-sm flex items-start gap-x-1 text-red-700 dark:text-red-300"
    >
      <InfoCircledIcon className="shrink-0" style={{ marginTop: 2 }} />
      {Array.isArray(children) ? children.join(", ") : children}
    </div>
  );
}
