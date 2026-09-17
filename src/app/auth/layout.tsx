export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
