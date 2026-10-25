import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export const sendFriendRequest = useMutation(api.social.sendRequest);
export const sendRespondsocial = useMutation(api.social.respond);
export const sendBlock = useMutation(api.social.block);
export const sendUnblock = useMutation(api.social.unblock);
export const sendCreateDirect = useMutation(api.conversations.createDirect);
