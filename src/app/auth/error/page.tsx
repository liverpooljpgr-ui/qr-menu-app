import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const { error } = await searchParams;
  const message = Array.isArray(error) ? error[0] : error;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Something went wrong</CardTitle>
        <CardDescription>We couldn&apos;t complete that sign-in step</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {message ?? "The link may have expired or already been used."}
        </p>
        <Button asChild variant="outline">
          <Link href="/auth/login">Back to log in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
