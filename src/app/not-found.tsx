import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="app-main">
      <EmptyState
        title="This page is not here"
        body="The link may be private, unpublished, or typed incorrectly."
        action={
          <Link className="btn" href="/">
            Back home
          </Link>
        }
      />
    </main>
  );
}
