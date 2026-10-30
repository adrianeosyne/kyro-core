import { useQuery } from "convex/react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { Hash, Loader2 } from "@/components/icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AdminPortal } from "@/components/app/AdminPortal";
import { AppShell } from "@/components/app/AppShell";
import { ChannelChat, DirectChat } from "@/components/app/ChatView";
import { DiscoverView } from "@/components/app/DiscoverView";
import { FriendsView } from "@/components/app/Friends";
import { ServerSettings } from "@/components/app/ServerSettings";
import { ServerThemeScope } from "@/components/app/ServerThemeScope";
import { VoiceChannelPage } from "@/components/app/VoiceChannelPage";

/** The signed-in product: everything lives inside the AppShell frame and is
 *  routed underneath it — friends home, DMs, community channels and the
 *  community settings panel.
 */
export default function Dashboard() {
  return (
    <AppShell>
      <Routes>
        <Route index element={<FriendsView />} />
        <Route path="discover" element={<DiscoverView />} />
        {/* Staff console — admins and moderators sign in with their Kyro
            account; the page itself gates access server-side. */}
        <Route path="admin" element={<AdminPortal />} />
        <Route path="dm" element={<Navigate to="/dashboard" replace />} />
        <Route path="dm/:conversationId" element={<DirectChatRoute />} />
        <Route path="s/:serverId" element={<ServerIndexRoute />} />
        <Route path="s/:serverId/c/:channelId" element={<ChannelRoute />} />
        <Route path="s/:serverId/v/:channelId" element={<VoiceChannelRoute />} />
        <Route path="s/:serverId/settings/*" element={<ServerSettingsRoute />} />
        {/* Wildcard must be last: any unknown slug within the dashboard falls back
            to the current community instead of a hard 404. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

function DirectChatRoute() {
  const { conversationId } = useParams();
  if (!conversationId) return <Navigate to="/dashboard" replace />;
  return <DirectChat conversationId={conversationId} />;
}

function ChannelRoute() {
  const { serverId, channelId } = useParams();
  if (!serverId || !channelId) return <Navigate to="/dashboard" replace />;
  return (
    <ServerThemeScope serverId={serverId as Id<"servers">}>
      <ChannelChat serverId={serverId} channelId={channelId} />
    </ServerThemeScope>
  );
}

function VoiceChannelRoute() {
  const { serverId, channelId } = useParams();
  if (!serverId || !channelId) return <Navigate to="/dashboard" replace />;
  return (
    <ServerThemeScope serverId={serverId as Id<"servers">}>
      <VoiceChannelPage serverId={serverId} channelId={channelId} />
    </ServerThemeScope>
  );
}

function ServerSettingsRoute() {
  const { serverId } = useParams();
  if (!serverId) return <Navigate to="/dashboard" replace />;
  return (
    <ServerThemeScope serverId={serverId as Id<"servers">}>
      <ServerSettings serverId={serverId} />
    </ServerThemeScope>
  );
}

/** Landing on a community drops you into its first readable channel. */
function ServerIndexRoute() {
  const { serverId } = useParams();
  const channels = useQuery(
    api.channels.list,
    serverId ? { serverId: serverId as Id<"servers"> } : "skip",
  );

  if (!serverId) return <Navigate to="/dashboard" replace />;

  if (channels === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const first = channels.channels[0];
  if (first) return <Navigate to={`/dashboard/s/${serverId}/c/${first.id}`} replace />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <Hash className="size-6 text-muted-foreground" />
      <p className="text-sm font-semibold">No channels yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        This community doesn't have any channels. Create the first one from the
        sidebar, or invite people to start the conversation.
      </p>
    </div>
  );
}
