import { Icon } from "@/lib/icon";

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border-muted bg-white py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-bg text-primary-fg">
        <Icon path={icon} size={1} />
      </div>
      <p className="font-bold text-on-surface">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-subtle">
        {description}
      </p>
    </div>
  );
}
