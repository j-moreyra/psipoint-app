import Link from "next/link";
import { SettingsIcon, UserIcon } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchBar } from "@/components/app/search-bar";
import { SignOutItem } from "@/components/app/sign-out-item";

interface AppShellUser {
  first_name: string;
  last_name: string;
  email: string;
}

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const initials =
    (user.first_name[0] ?? "") + (user.last_name[0] ?? "");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 sm:gap-4">
        <div className="flex shrink-0 items-center gap-5">
          <Link
            href="/dashboard"
            className="font-mono text-lg font-bold tracking-tight"
          >
            Psipoint
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link
              href="/customers"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Customers
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 justify-center sm:justify-start">
          <SearchBar />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Account menu"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs font-medium uppercase">
                {initials || <UserIcon className="size-4" />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {user.first_name} {user.last_name}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings/profile" />}>
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <SignOutItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
