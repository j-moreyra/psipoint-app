interface AuthShellProps {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-mono text-2xl font-bold tracking-tight">
            BackFLO
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Backflow testing
          </span>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 space-y-1">
            <h1 className="text-xl font-semibold leading-none">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {children}
        </div>
        {footer ? (
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}
