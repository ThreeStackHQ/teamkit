import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

interface Props {
  searchParams: { token?: string };
}

export default async function InviteAcceptPage({ searchParams }: Props) {
  const { token } = searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Link</h1>
          <p className="mt-2 text-gray-600">This invitation link is invalid.</p>
        </div>
      </div>
    );
  }

  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=/invite/accept?token=${token}`);
  }

  // Call the API to accept the invitation
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  let result: {
    success?: boolean;
    error?: string;
    workspaceId?: string;
    alreadyMember?: boolean;
  } = {};

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/invite/accept?token=${token}`,
      {
        headers: {
          // Server-side fetch doesn't have cookies automatically,
          // so we redirect instead
        },
      }
    );
    result = await res.json();
  } catch {
    result = { error: "Failed to process invitation" };
  }

  if (result.error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600">
            Invitation Error
          </h1>
          <p className="mt-2 text-gray-600">{result.error}</p>
          <a
            href="/dashboard"
            className="mt-4 inline-block text-violet-600 hover:underline"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (result.success) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-600">Processing your invitation...</p>
    </div>
  );
}
