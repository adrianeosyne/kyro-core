import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Headphones,
  Loader2,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
} from "@/components/icons";
import { DeviceBadge, UserAvatar } from "@/components/app/UserAvatar";
import { playNotificationPing } from "@/lib/sound";
import { useUiStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type ContainerType = "channel" | "conversation";

/** Microphone glyph — drawn here so the voice room stays self-contained. */
function MicGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5" />
      <path d="M8.5 21.5h7" />
    </svg>
  );
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/**
 * The peer with the lexicographically smaller user id makes the offer, so
 * exactly one side negotiates even though both peers join at the same moment.
 */
function isInitiator(localId: string, remoteId: string): boolean {
  return localId < remoteId;
}

/**
 * A live voice room: local microphone, one RTCPeerConnection per roster peer,
 * and Convex as the signaling relay. Renders the "connected" strip with the
 * roster plus the audio elements for everyone in the room.
 */
export function VoiceRoom({
  containerType,
  containerId,
  active,
  onLeave,
}: {
  containerType: ContainerType;
  containerId: string;
  /** True while this client is sitting in the room. */
  active: boolean;
  onLeave: () => void;
}) {
  const me = useQuery(api.users.me);
  const join = useMutation(api.voice.join);
  const leave = useMutation(api.voice.leave);
  const sendSignal = useMutation(api.voice.signal);
  const ackSignal = useMutation(api.voice.ackSignal);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const handledRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const roster = useQuery(
    api.voice.roster,
    active ? { containerType, containerId } : "skip",
  );
  const signals = useQuery(
    api.voice.signals,
    active ? { containerType, containerId } : "skip",
  );

  const closePeer = (peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((state) => {
      if (!(peerId in state)) return state;
      const next = { ...state };
      delete next[peerId];
      return next;
    });
  };

  // Mic acquisition + joining + liveness heartbeat.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let heartbeat = 0;

    const enter = async () => {
      setConnecting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        await join({ containerType, containerId, muted, deafened });
        heartbeat = window.setInterval(() => {
          void join({ containerType, containerId, muted, deafened }).catch(
            () => undefined,
          );
        }, 15_000);
      } catch (error) {
        if (cancelled) return;
        toast.error(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Microphone access was blocked — allow it to join voice."
            : "Couldn't join voice.",
        );
        onLeave();
      } finally {
        if (!cancelled) setConnecting(false);
      }
    };

    void enter();

    return () => {
      cancelled = true;
      if (heartbeat) window.clearInterval(heartbeat);
      void leave({ containerType, containerId }).catch(() => undefined);
      for (const peerId of Array.from(peersRef.current.keys())) closePeer(peerId);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      handledRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerType, containerId]);

  const ensurePeer = (peerId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(peerId, pc);
    const local = localStreamRef.current;
    local?.getTracks().forEach((track) => pc.addTrack(track, local));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal({
        containerType,
        containerId,
        toId: peerId as Id<"users">,
        kind: "ice",
        payload: JSON.stringify(event.candidate.toJSON()),
      }).catch(() => undefined);
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams((state) => ({ ...state, [peerId]: stream }));
    };
    return pc;
  };

  // Peer set follows the roster: open a connection for every new arrival,
  // drop the ones who left, and only the initiator sends the offer.
  useEffect(() => {
    if (!active || !roster || !me) return;
    const peerIds = roster
      .map((entry) => entry.userId)
      .filter((userId) => userId !== me.id);

    for (const peerId of Array.from(peersRef.current.keys())) {
      if (!peerIds.includes(peerId)) closePeer(peerId);
    }

    for (const peerId of peerIds) {
      if (peersRef.current.has(peerId)) continue;
      const pc = ensurePeer(peerId);
      if (!isInitiator(me.id, peerId)) continue;
      void (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal({
          containerType,
          containerId,
          toId: peerId as Id<"users">,
          kind: "offer",
          payload: JSON.stringify(pc.localDescription),
        });
      })().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roster, me?.id]);

  // Signaling inbox: answer offers, apply answers, trickle ICE.
  useEffect(() => {
    if (!active || !signals) return;
    for (const entry of signals) {
      if (handledRef.current.has(entry.id)) continue;
      handledRef.current.add(entry.id);
      void (async () => {
        const pc = ensurePeer(entry.fromId);
        const payload = JSON.parse(entry.payload) as unknown;
        if (entry.kind === "offer") {
          await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal({
            containerType,
            containerId,
            toId: entry.fromId as Id<"users">,
            kind: "answer",
            payload: JSON.stringify(pc.localDescription),
          });
        } else if (entry.kind === "answer") {
          if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
          }
        } else {
          await pc.addIceCandidate(payload as RTCIceCandidateInit);
        }
        await ackSignal({ signalId: entry.id as Id<"voiceSignals"> });
      })().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, active]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    void join({ containerType, containerId, muted: next, deafened }).catch(
      () => undefined,
    );
  };

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    void join({ containerType, containerId, muted, deafened: next }).catch(
      () => undefined,
    );
  };

  if (!active) return null;

  const peers = (roster ?? []).filter((entry) => entry.userId !== me?.id);
  const others = peers.length;
  const stateLabel =
    others > 0 ? `Voice connected · ${others + 1} in voice` : "Voice connected";

  return (
    <div className="border-t border-border/60 bg-panel px-3 py-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <span className="size-2 animate-pulse rounded-full bg-success" />
          {stateLabel}
        </span>

        <div className="flex -space-x-2">
          {(roster ?? []).map((entry) => (
            <span
              key={entry.userId}
              title={
                entry.user
                  ? `${entry.user.name}${entry.muted ? " · muted" : ""}`
                  : undefined
              }
              className="relative rounded-full ring-2 ring-panel"
            >
              {entry.user && <UserAvatar user={entry.user} size="sm" />}
              {entry.muted && (
                <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-white">
                  <MicOff className="size-2.5" />
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={muted ? "default" : "outline"}
            className="h-8 px-2.5"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="size-4" /> : <MicGlyph className="size-4" />}
          </Button>
          <Button
            size="sm"
            variant={deafened ? "default" : "outline"}
            className="h-8 px-2.5"
            onClick={toggleDeafen}
            aria-label={deafened ? "Undeafen" : "Deafen"}
            title={deafened ? "Undeafen" : "Deafen"}
          >
            <Headphones className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-2.5"
            onClick={onLeave}
            aria-label="Leave voice"
            title="Leave voice"
          >
            <PhoneOff className="size-4" />
          </Button>
        </div>
      </div>

      {connecting && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Connecting to voice…
        </p>
      )}

      {/* Remote audio — one element per peer, silenced while deafened. */}
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <audio
          key={peerId}
          autoPlay
          playsInline
          muted={deafened}
          ref={(element) => {
            if (element && element.srcObject !== stream) {
              element.srcObject = stream;
            }
          }}
        />
      ))}
    </div>
  );
}

/**
 * The call controls that live in a DM header: start a call when idle, cancel
 * while ringing out, accept/decline while ringing in, and a live pill while
 * the call is connected. The audio itself is mounted by the chat surface's
 * `VoiceRoom` — this component only drives the `calls` rows.
 */
export function DmCallHeader({
  conversationId,
}: {
  conversationId: string;
}) {
  const call = useQuery(api.voice.currentCall, {
    conversationId: conversationId as Id<"conversations">,
  });
  const startCall = useMutation(api.voice.startCall);
  const answerCall = useMutation(api.voice.answerCall);
  const endCall = useMutation(api.voice.endCall);
  const [busy, setBusy] = useState(false);

  if (call === undefined) return null;

  const hangUp = () => {
    if (!call) return;
    void endCall({ callId: call.id as Id<"calls"> }).catch(() => undefined);
  };

  if (!call) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        aria-label="Start voice call"
        title="Start voice call"
        className="h-8 w-8 shrink-0 px-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setBusy(true);
          void startCall({
            conversationId: conversationId as Id<"conversations">,
          })
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Couldn't start the call.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <Phone className="size-4" />
      </Button>
    );
  }

  const ringing = !call.answeredAt;

  // Someone is calling us: accept joins the room, decline hangs up and the
  // conversation records a missed call.
  if (ringing && !call.isCaller) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-surface py-1 pl-2.5 pr-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          Incoming call
        </span>
        <button
          type="button"
          aria-label="Accept call"
          title="Accept"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void answerCall({ callId: call.id as Id<"calls"> })
              .catch(() => undefined)
              .finally(() => setBusy(false));
          }}
          className="flex size-7 items-center justify-center rounded-full bg-success text-white transition-transform hover:scale-105"
        >
          <Phone className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Decline call"
          title="Decline"
          onClick={hangUp}
          className="flex size-7 items-center justify-center rounded-full bg-destructive text-white transition-transform hover:scale-105"
        >
          <PhoneOff className="size-3.5" />
        </button>
      </div>
    );
  }

  // We're calling out and nobody has picked up yet.
  if (ringing) {
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-surface py-1 pl-2.5 pr-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Calling…
        </span>
        <button
          type="button"
          aria-label="Cancel call"
          title="Cancel"
          onClick={hangUp}
          className="flex size-7 items-center justify-center rounded-full bg-destructive text-white transition-transform hover:scale-105"
        >
          <PhoneOff className="size-3.5" />
        </button>
      </div>
    );
  }

  // Connected — the VoiceRoom strip below the header carries the controls.
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <span className="size-1.5 animate-pulse rounded-full bg-success" />
      On a call
    </span>
  );
}

/** Roster grid for a voice channel page. */
export function VoiceRoster({
  containerType,
  containerId,
}: {
  containerType: ContainerType;
  containerId: string;
}) {
  const roster = useQuery(api.voice.roster, { containerType, containerId });
  if (roster === undefined) {
    return (
      <p className="text-sm text-muted-foreground">Loading voice…</p>
    );
  }
  if (roster.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody's here yet — join to start talking.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {roster.map((entry) => (
        <div
          key={entry.userId}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border/70 bg-surface p-3 transition-colors",
            entry.muted && "border-destructive/40",
          )}
        >
          {entry.user ? (
            <UserAvatar user={entry.user} size="md" />
          ) : (
            <span className="size-10 rounded-full bg-panel" />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {entry.user?.name ?? "Member"}
              {entry.user && <DeviceBadge device={entry.user.device} />}
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.muted ? "Muted" : "Voice connected"}
            </p>
          </div>
          {entry.muted && <MicOff className="ml-auto size-4 text-destructive" />}
        </div>
      ))}
    </div>
  );
}

/** Inline speaker glyph used by the sidebar for voice channels. */
export function VoiceChannelIcon({ className }: { className?: string }) {
  return <Volume2 className={className} />;
}

/**
 * Global ring banner: a DM call that's ringing surfaces over the whole app,
 * not just inside the conversation. Accept answers and jumps to the chat
 * (where the VoiceRoom mounts), decline hangs up and leaves a missed call.
 */
export function IncomingCallBanner() {
  const navigate = useNavigate();
  const incoming = useQuery(api.voice.incoming);
  const answerCall = useMutation(api.voice.answerCall);
  const endCall = useMutation(api.voice.endCall);

  const call = incoming && incoming.length > 0 ? incoming[0] : null;

  // One ping when a ring starts, honouring the notification-sound toggle.
  const wasRinging = useRef(false);
  useEffect(() => {
    const ringing = call !== null;
    if (ringing && !wasRinging.current) {
      if (useUiStore.getState().notificationSounds) playNotificationPing();
    }
    wasRinging.current = ringing;
  }, [call]);

  if (!call) return null;

  const accept = () => {
    void answerCall({ callId: call.callId as Id<"calls"> })
      .then(() => navigate(`/dashboard/dm/${call.conversationId}`))
      .catch(() => undefined);
  };
  const decline = () => {
    void endCall({ callId: call.callId as Id<"calls"> }).catch(
      () => undefined,
    );
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-panel p-3 shadow-xl shadow-black/20 md:bottom-6">
      <div className="flex items-center gap-2.5">
        {call.caller ? (
          <UserAvatar user={call.caller} size="md" />
        ) : (
          <span className="size-10 rounded-full bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {call.caller?.name ?? "Someone"}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Incoming voice call…
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={accept}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <Phone className="size-3.5" /> Accept
        </button>
        <button
          type="button"
          onClick={decline}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <PhoneOff className="size-3.5" /> Decline
        </button>
      </div>
    </div>
  );
}
