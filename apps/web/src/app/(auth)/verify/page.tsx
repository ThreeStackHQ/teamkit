export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow text-center">
        <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Magic link sent</h1>
        <p className="text-gray-600">
          Check your inbox and click the link to sign in to TeamKit. The link
          expires in 24 hours.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <a href="/login" className="text-violet-600 hover:underline">
            try again
          </a>
          .
        </p>
      </div>
    </div>
  );
}
