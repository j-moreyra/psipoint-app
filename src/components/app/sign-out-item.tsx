import { LogOutIcon } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Wrapped in a native form so the POST clears server-side (httpOnly)
// Supabase cookies via /auth/signout. The menu item renders as the submit
// button (base-ui `render` prop).
export function SignOutItem() {
  return (
    <form action="/auth/signout" method="POST" className="w-full">
      <DropdownMenuItem render={<button type="submit" />}>
        <LogOutIcon className="size-4" />
        Sign out
      </DropdownMenuItem>
    </form>
  );
}
