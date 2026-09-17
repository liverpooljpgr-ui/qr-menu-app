import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpSuccessPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Check your inbox</CardTitle>
        <CardDescription>We sent you a confirmation link</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Open the email and click the link to confirm your address. You&apos;ll be brought
          straight to setting up your restaurant.
        </p>
      </CardContent>
    </Card>
  );
}
