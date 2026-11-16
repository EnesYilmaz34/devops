export function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-clay mb-2">
            {eyebrow}
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            {title}
          </h1>
        </div>
        <div className="bg-white/60 border border-line rounded-sm p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block mb-4">
      <span className="block font-mono text-xs uppercase tracking-wide text-moss mb-1">
        {label}
      </span>
      <input
        {...props}
        className="w-full border-b-2 border-line bg-transparent py-2 font-body text-ink focus:border-moss transition-colors outline-none"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full bg-ink text-paper font-mono text-sm uppercase tracking-wide py-3 rounded-sm hover:bg-moss transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="text-clay text-sm font-mono mb-4 border-l-2 border-clay pl-3">
      {message}
    </p>
  );
}
