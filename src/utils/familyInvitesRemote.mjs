import { supabase } from "./supabaseClient.mjs";

export async function loadCareCircleRemote(babyId) {
  const token = await getAccessToken();
  const response = await fetch(`/api/family-invitations?babyId=${encodeURIComponent(babyId)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return readApiResponse(response);
}

export async function sendFamilyInviteRemote({ babyId, name, email, role }) {
  const token = await getAccessToken();
  const response = await fetch("/api/family-invitations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ babyId, name, email, role })
  });
  return readApiResponse(response);
}

export async function removeFamilyInviteRemote({ babyId, invitationId, userId }) {
  const token = await getAccessToken();
  const response = await fetch("/api/family-invitations", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ babyId, invitationId, userId })
  });
  return readApiResponse(response);
}

export async function acceptFamilyInviteRemote(token) {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/accept-family-invite", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ token })
  });
  return readApiResponse(response);
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error("Please log in first.");
  }
  return data.session.access_token;
}

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed. Please try again.");
  }
  return payload;
}
